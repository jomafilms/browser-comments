import { Pool } from 'pg';
import { randomBytes } from 'crypto';

// For local development, use standard pg Pool
// For production with Neon, use @neondatabase/serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Widget settings interface
export interface WidgetSettings {
  buttonText?: string;
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  modalTitle?: string;
  modalSubtitle?: string;
  successMessage?: string;
}

// Client and Project interfaces
export interface Client {
  id: number;
  token: string;
  widget_key: string;
  name: string;
  widget_settings: WidgetSettings | null;
  created_at: Date;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  created_at: Date;
}

export interface Assignee {
  id: number;
  client_id: number;
  name: string;
  created_at: Date;
}

export interface Comment {
  id: number;
  project_id: number | null;
  display_number: number; // Per-client sequential number (1, 2, 3...)
  url: string;
  page_section: string; // Auto-populated from URL path, can be manually overridden
  image_data: string; // base64 encoded image
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: string;
  submitter_name: string | null; // Name of the person who submitted the feedback
  created_at: Date;
  updated_at: Date;
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

// Current schema version - increment this when adding migrations
const SCHEMA_VERSION = 1;

// Check if schema is up to date (fast check that doesn't run migrations)
async function isSchemaUpToDate(): Promise<boolean> {
  const client = await pool.connect();
  try {
    // Check if schema_version table exists and has current version
    const result = await client.query(`
      SELECT version FROM schema_version WHERE id = 1
    `);
    return result.rows.length > 0 && result.rows[0].version >= SCHEMA_VERSION;
  } catch {
    // Table doesn't exist yet, needs initialization
    return false;
  } finally {
    client.release();
  }
}

// Initialize database schema (only runs if needed)
export async function initDB() {
  // Quick check - skip everything if already initialized
  if (await isSchemaUpToDate()) {
    return;
  }

  const client = await pool.connect();
  try {
    // Create schema version tracking table first
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY DEFAULT 1,
        version INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create clients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        token VARCHAR(32) UNIQUE NOT NULL,
        widget_key VARCHAR(32) UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add widget_key and widget_settings columns if they don't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='widget_key') THEN
          ALTER TABLE clients ADD COLUMN widget_key VARCHAR(32) UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='widget_settings') THEN
          ALTER TABLE clients ADD COLUMN widget_settings JSONB DEFAULT '{}';
        END IF;
      END $$;
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

    // Create assignees table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignees (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_id, name)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignees_client_id ON assignees(client_id);
    `);

    // Create table with base columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        page_section TEXT NOT NULL,
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
          ALTER TABLE comments ADD COLUMN assignee TEXT DEFAULT 'Unassigned';
        ELSE
          -- Drop old constraint to allow any assignee value
          ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_assignee_check;
          -- Update any NULL values
          UPDATE comments SET assignee = 'Unassigned' WHERE assignee IS NULL OR assignee = '';
          -- Set default
          ALTER TABLE comments ALTER COLUMN assignee SET DEFAULT 'Unassigned';
        END IF;
        -- Add project_id column to comments
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='project_id') THEN
          ALTER TABLE comments ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
        -- Add client_id column for per-client numbering
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='client_id') THEN
          ALTER TABLE comments ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
        END IF;
        -- Add display_number for per-client sequential numbering
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='display_number') THEN
          ALTER TABLE comments ADD COLUMN display_number INTEGER DEFAULT 0;
        END IF;
        -- Add submitter_name column for feedback author
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='submitter_name') THEN
          ALTER TABLE comments ADD COLUMN submitter_name TEXT;
        END IF;
      END $$;
    `);

    // Backfill client_id from project_id for existing comments
    await client.query(`
      UPDATE comments c
      SET client_id = p.client_id
      FROM projects p
      WHERE c.project_id = p.id
        AND c.client_id IS NULL;
    `);

    // Backfill display_number for existing comments (per client, ordered by created_at)
    await client.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at) as rn
        FROM comments
        WHERE display_number = 0 OR display_number IS NULL
      )
      UPDATE comments c
      SET display_number = n.rn
      FROM numbered n
      WHERE c.id = n.id;
    `);

    // Rename project_name to page_section (for existing databases with old column name)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='project_name')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='page_section') THEN
          ALTER TABLE comments RENAME COLUMN project_name TO page_section;
        END IF;
      END $$;
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_section ON comments(page_section);`);
    await client.query(`
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

    // Mark schema as up to date (upsert)
    await client.query(`
      INSERT INTO schema_version (id, version, updated_at) VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET version = $1, updated_at = NOW()
    `, [SCHEMA_VERSION]);
  } finally {
    client.release();
  }
}

// Helper to extract page section from URL path (returns raw path)
function extractPageSection(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Return 'Home' for root path
    if (!path || path === '/') {
      return 'Home';
    }

    // Remove trailing slash and return the path as-is
    return path.replace(/\/$/, '');
  } catch {
    return 'Unknown';
  }
}

export async function saveComment(data: {
  url: string;
  pageSection?: string; // Optional - if not provided, auto-extracted from URL path
  imageData: string;
  textAnnotations: TextAnnotation[];
  priority?: 'high' | 'med' | 'low';
  priorityNumber?: number;
  assignee?: string;
  projectId?: number;
  submitterName?: string;
}): Promise<Comment> {
  const dbClient = await pool.connect();
  try {
    // Get client_id from project if projectId is provided
    let clientId: number | null = null;
    if (data.projectId) {
      const projectResult = await dbClient.query(
        'SELECT client_id FROM projects WHERE id = $1',
        [data.projectId]
      );
      if (projectResult.rows.length > 0) {
        clientId = projectResult.rows[0].client_id;
      }
    }

    // Calculate next display_number for this client
    let displayNumber = 1;
    if (clientId) {
      const maxResult = await dbClient.query(
        'SELECT COALESCE(MAX(display_number), 0) as max_num FROM comments WHERE client_id = $1',
        [clientId]
      );
      displayNumber = maxResult.rows[0].max_num + 1;
    }

    // Auto-extract page section from URL if not provided
    const pageSection = data.pageSection || extractPageSection(data.url);

    const result = await dbClient.query(
      `INSERT INTO comments (url, page_section, image_data, text_annotations, priority, priority_number, assignee, project_id, client_id, display_number, submitter_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.url,
        pageSection,
        data.imageData,
        JSON.stringify(data.textAnnotations),
        data.priority || 'med',
        data.priorityNumber || 0,
        data.assignee || 'Unassigned',
        data.projectId || null,
        clientId,
        displayNumber,
        data.submitterName || null
      ]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

export async function getComments(filters?: {
  pageSection?: string;
  status?: 'open' | 'resolved';
  priority?: 'high' | 'med' | 'low';
  assignee?: string;
  excludeImages?: boolean;
}): Promise<Comment[]> {
  const client = await pool.connect();
  try {
    // If excludeImages is true, select all fields except image_data
    const selectClause = filters?.excludeImages
      ? 'id, project_id, client_id, display_number, url, page_section, \'\' as image_data, text_annotations, status, priority, priority_number, assignee, submitter_name, created_at, updated_at'
      : '*';

    let query = `SELECT ${selectClause} FROM comments WHERE 1=1`;
    const params: any[] = [];

    if (filters?.pageSection) {
      params.push(filters.pageSection);
      query += ` AND page_section = $${params.length}`;
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

export async function getPageSections(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT page_section FROM comments ORDER BY page_section`
    );
    return result.rows.map(row => row.page_section);
  } finally {
    client.release();
  }
}

export async function updatePageSection(
  oldName: string,
  newName: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE comments SET page_section = $1 WHERE page_section = $2`,
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
  assignee: string
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
    const widgetKey = generateToken();
    const result = await dbClient.query(
      `INSERT INTO clients (token, widget_key, name) VALUES ($1, $2, $3) RETURNING *`,
      [token, widgetKey, name]
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

export async function getClientByWidgetKey(widgetKey: string): Promise<Client | null> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM clients WHERE widget_key = $1`,
      [widgetKey]
    );
    return result.rows[0] || null;
  } finally {
    dbClient.release();
  }
}

// Get project by matching origin URL
export async function getProjectByOrigin(clientId: number, origin: string): Promise<Project | null> {
  const dbClient = await pool.connect();
  try {
    // Match project URL that starts with or contains the origin
    const result = await dbClient.query(
      `SELECT * FROM projects WHERE client_id = $1 AND (
        url LIKE $2 || '%' OR
        url LIKE '%://' || $3 || '%' OR
        $2 LIKE url || '%'
      ) LIMIT 1`,
      [clientId, origin, origin.replace(/^https?:\/\//, '')]
    );
    return result.rows[0] || null;
  } finally {
    dbClient.release();
  }
}

// Generate widget key for existing clients that don't have one
export async function generateWidgetKeyForClient(clientId: number): Promise<string> {
  const dbClient = await pool.connect();
  try {
    const widgetKey = generateToken();
    await dbClient.query(
      `UPDATE clients SET widget_key = $1 WHERE id = $2 AND widget_key IS NULL`,
      [widgetKey, clientId]
    );
    return widgetKey;
  } finally {
    dbClient.release();
  }
}

// Update widget settings for a client
export async function updateWidgetSettings(clientId: number, settings: WidgetSettings): Promise<Client> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `UPDATE clients SET widget_settings = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(settings), clientId]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

// Get widget settings by widget key (for widget.js to fetch)
export async function getWidgetSettingsByKey(widgetKey: string): Promise<WidgetSettings | null> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT widget_settings FROM clients WHERE widget_key = $1`,
      [widgetKey]
    );
    return result.rows[0]?.widget_settings || null;
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
      ? 'id, project_id, client_id, display_number, url, page_section, \'\' as image_data, text_annotations, status, priority, priority_number, assignee, submitter_name, created_at, updated_at'
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
      ? 'c.id, c.project_id, c.client_id, c.display_number, c.url, c.page_section, \'\' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at'
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

// Assignee CRUD functions
export async function createAssignee(clientId: number, name: string): Promise<Assignee> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `INSERT INTO assignees (client_id, name) VALUES ($1, $2) RETURNING *`,
      [clientId, name]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

export async function getAssigneesByClientId(clientId: number): Promise<Assignee[]> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `SELECT * FROM assignees WHERE client_id = $1 ORDER BY name`,
      [clientId]
    );
    return result.rows;
  } finally {
    dbClient.release();
  }
}

export async function deleteAssignee(id: number): Promise<void> {
  const dbClient = await pool.connect();
  try {
    await dbClient.query(`DELETE FROM assignees WHERE id = $1`, [id]);
  } finally {
    dbClient.release();
  }
}

export async function updateAssignee(id: number, name: string): Promise<Assignee> {
  const dbClient = await pool.connect();
  try {
    const result = await dbClient.query(
      `UPDATE assignees SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );
    return result.rows[0];
  } finally {
    dbClient.release();
  }
}

export default pool;
