import { Pool } from 'pg';
import { randomBytes } from 'crypto';

// For local development, use standard pg Pool
// For production with Neon, use @neondatabase/serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Client and Project interfaces
export interface Client {
  id: number;
  token: string;
  name: string;
  created_at: Date;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  created_at: Date;
}

export interface Comment {
  id: number;
  project_id: number | null;
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
    // Create clients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        token VARCHAR(32) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for clients and projects
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_token ON clients(token);
      CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
    `);

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
          -- Drop old constraint first (allows us to update dev4 values)
          ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_assignee_check;
          -- Migrate dev4 to Sessions
          UPDATE comments SET assignee = 'Sessions' WHERE assignee = 'dev4';
          -- Update any NULL values to dev1
          UPDATE comments SET assignee = 'dev1' WHERE assignee IS NULL;
          -- Recreate constraint with new values
          ALTER TABLE comments ADD CONSTRAINT comments_assignee_check CHECK (assignee IN ('dev1', 'dev2', 'dev3', 'Sessions', 'Annie', 'Mari'));
          -- Make column NOT NULL
          ALTER TABLE comments ALTER COLUMN assignee SET DEFAULT 'dev1';
          ALTER TABLE comments ALTER COLUMN assignee SET NOT NULL;
        END IF;
        -- Add project_id column to comments
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='project_id') THEN
          ALTER TABLE comments ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
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

    // Create decision_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS decision_items (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        note_text TEXT NOT NULL,
        note_index INTEGER,
        source TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add source and project_id columns if they don't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_items' AND column_name='source') THEN
          ALTER TABLE decision_items ADD COLUMN source TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_items' AND column_name='project_id') THEN
          ALTER TABLE decision_items ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Create indexes for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_decision_comment_id ON decision_items(comment_id);
      CREATE INDEX IF NOT EXISTS idx_decision_project_id ON decision_items(project_id);
      CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
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
  projectId?: number;
}): Promise<Comment> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO comments (url, project_name, image_data, text_annotations, priority, priority_number, assignee, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.url,
        data.projectName,
        data.imageData,
        JSON.stringify(data.textAnnotations),
        data.priority || 'med',
        data.priorityNumber || 0,
        data.assignee || 'dev1',
        data.projectId || null
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

// Decision Items functions
export interface DecisionItem {
  id: number;
  comment_id: number | null;
  project_id: number | null;
  note_text: string;
  note_index: number | null;
  source: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function addDecisionItem(
  noteText: string,
  commentId?: number | null,
  noteIndex?: number | null,
  source?: string | null,
  projectId?: number | null
): Promise<DecisionItem> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO decision_items (comment_id, note_text, note_index, source, project_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [commentId || null, noteText, noteIndex || null, source || null, projectId || null]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getDecisionItems(): Promise<DecisionItem[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM decision_items ORDER BY created_at DESC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function updateDecisionItem(
  id: number,
  noteText: string,
  source?: string | null
): Promise<DecisionItem> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE decision_items
       SET note_text = $1, source = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [noteText, source || null, id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function deleteDecisionItem(id: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM decision_items WHERE id = $1`, [id]);
  } finally {
    client.release();
  }
}

export async function getDecisionItemsByCommentId(commentId: number): Promise<DecisionItem[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM decision_items WHERE comment_id = $1 ORDER BY note_index`,
      [commentId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Client CRUD functions
function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export async function createClient(name: string): Promise<Client> {
  const dbClient = await pool.connect();
  try {
    const token = generateToken();
    const result = await dbClient.query(
      `INSERT INTO clients (token, name) VALUES ($1, $2) RETURNING *`,
      [token, name]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

export async function getClientByToken(token: string): Promise<Client | null> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM clients WHERE token = $1`,
      [token]
    );
    return result.rows[0] || null;
  } finally {
    dbClient.release();
  }
}

export async function getClients(): Promise<Client[]> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM clients ORDER BY name`
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

export async function deleteClient(id: number): Promise<void> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query(`DELETE FROM clients WHERE id = $1`, [id]);
  } finally {
    dbClient.release();
  }
}

// Project CRUD functions
export async function createProject(clientId: number, name: string, url: string): Promise<Project> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `INSERT INTO projects (client_id, name, url) VALUES ($1, $2, $3) RETURNING *`,
      [clientId, name, url]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

export async function getProjectsByClientId(clientId: number): Promise<Project[]> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM projects WHERE client_id = $1 ORDER BY name`,
      [clientId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

export async function getProjectById(id: number): Promise<Project | null> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } finally {
    dbClient.release();
  }
}

export async function deleteProject(id: number): Promise<void> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query(`DELETE FROM projects WHERE id = $1`, [id]);
  } finally {
    dbClient.release();
  }
}

// Get comments by project ID
export async function getCommentsByProjectId(projectId: number, excludeImages?: boolean): Promise<Comment[]> {
  const dbClient = await pool.connect();
  try {
    const selectClause = excludeImages
      ? 'id, project_id, url, project_name, \'\' as image_data, text_annotations, status, priority, priority_number, assignee, created_at, updated_at'
      : '*';

    const result = await dbClient.query(
      `SELECT ${selectClause} FROM comments WHERE project_id = $1
       ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 WHEN 'low' THEN 3 END,
         priority_number DESC,
         created_at DESC`,
      [projectId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

// Get comments by client ID (all projects for a client)
export async function getCommentsByClientId(clientId: number, excludeImages?: boolean): Promise<Comment[]> {
  const dbClient = await pool.connect();
  try {
    const selectClause = excludeImages
      ? 'c.id, c.project_id, c.url, c.project_name, \'\' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.created_at, c.updated_at'
      : 'c.*';

    const result = await dbClient.query(
      `SELECT ${selectClause} FROM comments c
       JOIN projects p ON c.project_id = p.id
       WHERE p.client_id = $1
       ORDER BY
         CASE c.priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 WHEN 'low' THEN 3 END,
         c.priority_number DESC,
         c.created_at DESC`,
      [clientId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

// Get decision items by project ID
export async function getDecisionItemsByProjectId(projectId: number): Promise<DecisionItem[]> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM decision_items WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

// Get decision items by client ID
export async function getDecisionItemsByClientId(clientId: number): Promise<DecisionItem[]> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT d.* FROM decision_items d
       JOIN projects p ON d.project_id = p.id
       WHERE p.client_id = $1
       ORDER BY d.created_at DESC`,
      [clientId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

export default pool;
