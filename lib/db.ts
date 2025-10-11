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

      CREATE INDEX IF NOT EXISTS idx_project_name ON comments(project_name);
      CREATE INDEX IF NOT EXISTS idx_status ON comments(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON comments(created_at DESC);
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
}): Promise<Comment> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO comments (url, project_name, image_data, text_annotations)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.url, data.projectName, data.imageData, JSON.stringify(data.textAnnotations)]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getComments(filters?: {
  projectName?: string;
  status?: 'open' | 'resolved';
}): Promise<Comment[]> {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM comments WHERE 1=1';
    const params: any[] = [];

    if (filters?.projectName) {
      params.push(filters.projectName);
      query += ` AND project_name = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

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
    await client.query(
      `UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
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

export default pool;
