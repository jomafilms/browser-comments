import { Pool } from 'pg';

// For local development, use standard pg Pool
// For production with Neon, use @neondatabase/serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface Comment {
  id: number;
  url: string;
  project_name: string;
  image_data: string; // base64 encoded image
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari';
  created_at: Date;
  updated_at: Date;
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

// Initialize database schema
export async function initDB() {
  const client = await pool.connect();
  try {
    // Create table with base columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        project_name TEXT NOT NULL,
        image_data TEXT NOT NULL,
        text_annotations JSONB DEFAULT '[]',
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add new columns if they don't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='priority') THEN
          ALTER TABLE comments ADD COLUMN priority TEXT DEFAULT 'med';
          ALTER TABLE comments ADD CONSTRAINT comments_priority_check CHECK (priority IN ('high', 'med', 'low'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='priority_number') THEN
          ALTER TABLE comments ADD COLUMN priority_number INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='assignee') THEN
          ALTER TABLE comments ADD COLUMN assignee TEXT DEFAULT 'dev1';
          ALTER TABLE comments ADD CONSTRAINT comments_assignee_check CHECK (assignee IN ('dev1', 'dev2', 'dev3', 'Sessions', 'Annie', 'Mari'));
        ELSE
          -- Migrate dev4 to Sessions before updating constraint
          UPDATE comments SET assignee = 'Sessions' WHERE assignee = 'dev4';
          -- Drop old constraint if it exists and recreate with new values (no NULL)
          ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_assignee_check;
          ALTER TABLE comments ADD CONSTRAINT comments_assignee_check CHECK (assignee IN ('dev1', 'dev2', 'dev3', 'Sessions', 'Annie', 'Mari'));
          -- Update any NULL values to dev1
          UPDATE comments SET assignee = 'dev1' WHERE assignee IS NULL;
          -- Make column NOT NULL
          ALTER TABLE comments ALTER COLUMN assignee SET DEFAULT 'dev1';
          ALTER TABLE comments ALTER COLUMN assignee SET NOT NULL;
        END IF;
      END $$;
    `);

    // Create indexes after columns exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_name ON comments(project_name);
      CREATE INDEX IF NOT EXISTS idx_status ON comments(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON comments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_priority ON comments(priority);
      CREATE INDEX IF NOT EXISTS idx_assignee ON comments(assignee);
    `);
  } finally {
    client.release();
  }
}

export async function saveComment(data: {
  url: string;
  projectName: string;
  imageData: string;
  textAnnotations: TextAnnotation[];
  priority?: 'high' | 'med' | 'low';
  priorityNumber?: number;
  assignee?: 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari';
}): Promise<Comment> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO comments (url, project_name, image_data, text_annotations, priority, priority_number, assignee)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.url,
        data.projectName,
        data.imageData,
        JSON.stringify(data.textAnnotations),
        data.priority || 'med',
        data.priorityNumber || 0,
        data.assignee || 'dev1'
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getComments(filters?: {
  projectName?: string;
  status?: 'open' | 'resolved';
  priority?: 'high' | 'med' | 'low';
  assignee?: 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari';
  excludeImages?: boolean;
}): Promise<Comment[]> {
  const client = await pool.connect();
  try {
    // If excludeImages is true, select all fields except image_data
    const selectClause = filters?.excludeImages
      ? 'id, url, project_name, \'\' as image_data, text_annotations, status, priority, priority_number, assignee, created_at, updated_at'
      : '*';

    let query = `SELECT ${selectClause} FROM comments WHERE 1=1`;
    const params: any[] = [];

    if (filters?.projectName) {
      params.push(filters.projectName);
      query += ` AND project_name = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    if (filters?.priority) {
      params.push(filters.priority);
      query += ` AND priority = $${params.length}`;
    }

    if (filters?.assignee) {
      params.push(filters.assignee);
      query += ` AND assignee = $${params.length}`;
    }

    // Order by priority (high > med > low), then priority_number, then created_at
    query += ` ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'med' THEN 2
        WHEN 'low' THEN 3
      END,
      priority_number DESC,
      created_at DESC`;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function updateCommentStatus(
  id: number,
  status: 'open' | 'resolved'
): Promise<void> {
  const client = await pool.connect();
  try {
    // When resolving a comment, also reset priority_number to 0
    if (status === 'resolved') {
      await client.query(
        `UPDATE comments SET status = $1, priority_number = 0, updated_at = NOW() WHERE id = $2`,
        [status, id]
      );
    } else {
      await client.query(
        `UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id]
      );
    }
  } finally {
    client.release();
  }
}

export async function addNoteToComment(
  id: number,
  note: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE comments
       SET text_annotations = text_annotations || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ text: note, x: 0, y: 0, color: 'black' }]), id]
    );
  } finally {
    client.release();
  }
}

export async function getProjects(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT project_name FROM comments ORDER BY project_name`
    );
    return result.rows.map(row => row.project_name);
  } finally {
    client.release();
  }
}

export async function updateProjectName(
  oldName: string,
  newName: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE comments SET project_name = $1 WHERE project_name = $2`,
      [newName, oldName]
    );
  } finally {
    client.release();
  }
}

export async function deleteComment(id: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM comments WHERE id = $1`, [id]);
  } finally {
    client.release();
  }
}

export async function updateCommentPriority(
  id: number,
  priority: 'high' | 'med' | 'low',
  priorityNumber: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE comments SET priority = $1, priority_number = $2, updated_at = NOW() WHERE id = $3`,
      [priority, priorityNumber, id]
    );
  } finally {
    client.release();
  }
}

export async function updateCommentAssignee(
  id: number,
  assignee: 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari'
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE comments SET assignee = $1, updated_at = NOW() WHERE id = $2`,
      [assignee, id]
    );
  } finally {
    client.release();
  }
}

export default pool;
