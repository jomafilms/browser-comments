import { PoolClient } from 'pg';
import { pool } from './pool';
import { applyBaseSchema } from './schema-base';
import { generateRefPrefix, dedupeRefPrefix } from './refs';

// Current schema version - increment this when adding migrations
const SCHEMA_VERSION = 5;

// Check if schema is up to date (fast check that doesn't run migrations)
async function isSchemaUpToDate(): Promise<boolean> {
  const client = await pool.connect();
  try {
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

// v4 (additive only): uuid external ids, per-project ticket numbers with
// Jira-style refs, and operator branding storage.
async function applySchemaV4(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='uuid') THEN
        ALTER TABLE comments ADD COLUMN uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_items' AND column_name='uuid') THEN
        ALTER TABLE decision_items ADD COLUMN uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='ref_prefix') THEN
        ALTER TABLE projects ADD COLUMN ref_prefix VARCHAR(8);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='project_number') THEN
        ALTER TABLE comments ADD COLUMN project_number INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='branding') THEN
        ALTER TABLE clients ADD COLUMN branding JSONB DEFAULT '{}';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='branding') THEN
        ALTER TABLE projects ADD COLUMN branding JSONB DEFAULT '{}';
      END IF;
    END $$;
  `);

  // Instance-level operator branding (single row)
  await client.query(`
    CREATE TABLE IF NOT EXISTS instance_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      branding JSONB DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    INSERT INTO instance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);

  // Auto-generate ref_prefix from project names, deduped within each client
  const projects = await client.query(
    `SELECT id, client_id, name, ref_prefix FROM projects ORDER BY client_id, id`
  );
  const usedByClient = new Map<number, Set<string>>();
  const usedFor = (clientId: number) => {
    if (!usedByClient.has(clientId)) usedByClient.set(clientId, new Set());
    return usedByClient.get(clientId)!;
  };
  for (const p of projects.rows.filter((r) => r.ref_prefix)) {
    usedFor(p.client_id).add(p.ref_prefix);
  }
  for (const p of projects.rows.filter((r) => !r.ref_prefix)) {
    const used = usedFor(p.client_id);
    const prefix = dedupeRefPrefix(generateRefPrefix(p.name), used);
    used.add(prefix);
    await client.query(`UPDATE projects SET ref_prefix = $1 WHERE id = $2`, [prefix, p.id]);
  }

  // Backfill project_number in creation order. Offset by any existing max so
  // a partially-applied migration never assigns duplicates.
  await client.query(`
    WITH numbered AS (
      SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS rn
      FROM comments
      WHERE project_id IS NOT NULL AND project_number IS NULL
    ), offsets AS (
      SELECT project_id, COALESCE(MAX(project_number), 0) AS base
      FROM comments WHERE project_id IS NOT NULL GROUP BY project_id
    )
    UPDATE comments c
    SET project_number = o.base + n.rn
    FROM numbered n JOIN offsets o ON n.project_id = o.project_id
    WHERE c.id = n.id;
  `);

  // The old MAX+1 allocation raced, so existing data can hold duplicate
  // display_numbers. Renumber the later duplicates past the client's max
  // before adding the unique index.
  await client.query(`
    WITH ranked AS (
      SELECT id, client_id,
             ROW_NUMBER() OVER (PARTITION BY client_id, display_number ORDER BY created_at, id) AS rn
      FROM comments WHERE client_id IS NOT NULL
    ), maxes AS (
      SELECT client_id, MAX(display_number) AS maxn
      FROM comments WHERE client_id IS NOT NULL GROUP BY client_id
    ), renumber AS (
      SELECT r.id, m.maxn + ROW_NUMBER() OVER (PARTITION BY r.client_id ORDER BY r.id) AS newn
      FROM ranked r JOIN maxes m ON r.client_id = m.client_id
      WHERE r.rn > 1
    )
    UPDATE comments c SET display_number = r.newn FROM renumber r WHERE c.id = r.id;
  `);

  // Unique indexes back the atomic number allocation (INSERT retries once on
  // conflict). NULLs are distinct, so orphan comments never collide.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_comments_project_number ON comments(project_id, project_number);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_comments_client_display ON comments(client_id, display_number);
  `);
}

// v5 (additive only): outbound webhooks. One row per registered endpoint,
// scoped to a client and optionally a single project (null = all the client's
// projects). secret is an HMAC signing key stored in plain text (it signs
// outbound bodies; it is not a login credential).
async function applySchemaV5(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret VARCHAR(64) NOT NULL,
      events TEXT[] NOT NULL DEFAULT ARRAY['comment.created'],
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      last_status INTEGER,
      last_fired_at TIMESTAMP
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_webhooks_client_id ON webhooks(client_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_project_id ON webhooks(project_id);
  `);
}

// Initialize database schema (only runs if needed).
// Canonical explicit runner: `npm run init-db`. Also invoked lazily via
// withClient() as a zero-config fallback on fresh deploys.
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

    await applyBaseSchema(client);
    await applySchemaV4(client);
    await applySchemaV5(client);

    // Mark schema as up to date (upsert)
    await client.query(`
      INSERT INTO schema_version (id, version, updated_at) VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET version = $1, updated_at = NOW()
    `, [SCHEMA_VERSION]);
  } finally {
    client.release();
  }
}

// Memoized init — at most one real schema check per cold start. Reset on
// failure so a transient DB outage doesn't wedge the process.
let initPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = initDB().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
