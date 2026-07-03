import { PoolClient } from 'pg';

// Base schema (schema versions 1–3): tables, columns, indexes, and the
// original backfills. Everything is idempotent (IF NOT EXISTS / guarded DO
// blocks) so it can run against a blank DB or any older version in place.
// v4 additions live in schema.ts.
export async function applyBaseSchema(client: PoolClient): Promise<void> {
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

  // Add token column to projects for project-level access control
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='token') THEN
        ALTER TABLE projects ADD COLUMN token VARCHAR(32) UNIQUE;
      END IF;
    END $$;
  `);

  // Create indexes for clients and projects
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_clients_token ON clients(token);
    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(token);
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

  // Create comments table with base columns
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
      -- Device/browser tracking
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='user_agent') THEN
        ALTER TABLE comments ADD COLUMN user_agent TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='viewport_w') THEN
        ALTER TABLE comments ADD COLUMN viewport_w INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='viewport_h') THEN
        ALTER TABLE comments ADD COLUMN viewport_h INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='device_category') THEN
        ALTER TABLE comments ADD COLUMN device_category TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='device_model') THEN
        ALTER TABLE comments ADD COLUMN device_model TEXT;
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
    CREATE INDEX IF NOT EXISTS idx_device_category ON comments(client_id, device_category);
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
}
