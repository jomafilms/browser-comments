import { Pool } from 'pg';
import { Ticket, TicketFilters } from './types';

// Image-free column list (image_data is the heaviest column). Includes uuid +
// project_number so refs resolve. Queries JOIN projects as `p` for ref_prefix.
const LIGHT_COLUMNS =
  "c.id, c.uuid, c.project_id, c.client_id, c.display_number, c.project_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at";

// Computed ref column ("LWF-12"), mirrors the server's refSelectSql.
const REF_EXPR =
  "CASE WHEN c.project_number IS NOT NULL AND p.ref_prefix IS NOT NULL THEN p.ref_prefix || '-' || c.project_number::text END AS ref";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_RE = /^([A-Za-z][A-Za-z0-9]{0,7})-([0-9]+)$/;

let pool: Pool | null = null;

function getPool(dbUrl: string): Pool {
  if (!pool) {
    // Default certificate verification — Neon presents a valid cert
    const ssl = dbUrl.includes('neon.tech') ? true : undefined;
    pool = new Pool({ connectionString: dbUrl, ssl });
  }
  return pool;
}

interface TokenContext {
  clientId: number;
  projectId: number | null;
}

// Resolve token — checks project tokens first, then client tokens
export async function resolveTokenContext(dbUrl: string, token: string): Promise<TokenContext | null> {
  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    // Check project tokens first (more specific scope)
    const projectResult = await client.query(
      'SELECT id, client_id FROM projects WHERE token = $1',
      [token]
    );
    if (projectResult.rows.length > 0) {
      return {
        clientId: projectResult.rows[0].client_id,
        projectId: projectResult.rows[0].id,
      };
    }

    // Fall back to client token
    const clientResult = await client.query('SELECT id FROM clients WHERE token = $1', [token]);
    if (clientResult.rows[0]) {
      return { clientId: clientResult.rows[0].id, projectId: null };
    }
    return null;
  } finally {
    client.release();
  }
}

// Kept for backwards compat but uses resolveTokenContext internally
export async function getClientIdByToken(dbUrl: string, token: string): Promise<number | null> {
  const ctx = await resolveTokenContext(dbUrl, token);
  return ctx?.clientId ?? null;
}

export async function queryTickets(
  dbUrl: string,
  token: string,
  filters: TicketFilters,
  excludeImages: boolean = true
): Promise<Ticket[]> {
  const ctx = await resolveTokenContext(dbUrl, token);
  if (!ctx) {
    throw new Error('Invalid token — no matching client or project found.');
  }

  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const selectClause = excludeImages ? LIGHT_COLUMNS : 'c.*';

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    // Scope by project token or client token
    if (ctx.projectId) {
      conditions.push(`c.project_id = $${paramIdx++}`);
      params.push(ctx.projectId);
    } else {
      conditions.push(`p.client_id = $${paramIdx++}`);
      params.push(ctx.clientId);
    }

    if (filters.status) {
      conditions.push(`c.status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.priority) {
      conditions.push(`c.priority = $${paramIdx++}`);
      params.push(filters.priority);
    }
    if (filters.assignee) {
      conditions.push(`c.assignee = $${paramIdx++}`);
      params.push(filters.assignee);
    }
    if (filters.section) {
      conditions.push(`c.page_section ILIKE $${paramIdx++}`);
      params.push(`%${filters.section}%`);
    }
    if (filters.project && !ctx.projectId) {
      conditions.push(`c.project_id = $${paramIdx++}`);
      params.push(parseInt(filters.project));
    }
    if (filters.since) {
      // Interpret the naive `updated_at` in the DB session tz and compare true
      // instants (see lib/db/comments.ts) — avoids the UTC-vs-local-naive skew.
      conditions.push(
        `date_trunc('milliseconds', c.updated_at AT TIME ZONE current_setting('TimeZone')) > $${paramIdx++}::timestamptz`
      );
      params.push(filters.since);
    }

    const sql = `SELECT ${selectClause}, ${REF_EXPR} FROM comments c
       JOIN projects p ON c.project_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE c.priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 WHEN 'low' THEN 3 END,
         c.priority_number DESC,
         c.created_at DESC`;

    const result = await client.query(sql, params);
    return result.rows.map(mapRow);
  } finally {
    client.release();
  }
}

// Resolve a single ticket by uuid / ref ("LWF-12") / bare number (legacy
// display_number), scoped to the token. Mirrors the server's findCommentByRef
// (this package can't import lib/db, so the resolution is kept minimal here).
export async function queryTicketByRef(
  dbUrl: string,
  token: string,
  ref: string,
  includeImages: boolean = false
): Promise<Ticket | null> {
  const ctx = await resolveTokenContext(dbUrl, token);
  if (!ctx) {
    throw new Error('Invalid token — no matching client or project found.');
  }

  const value = ref.trim();
  let matchCondition: string;
  const params: (string | number)[] = [];
  const refMatch = REF_RE.exec(value);
  if (UUID_RE.test(value)) {
    matchCondition = 'c.uuid = $1';
    params.push(value);
  } else if (refMatch) {
    matchCondition = 'UPPER(p.ref_prefix) = $1 AND c.project_number = $2';
    params.push(refMatch[1].toUpperCase(), parseInt(refMatch[2], 10));
  } else if (/^\d+$/.test(value) && parseInt(value, 10) <= 2147483647) {
    matchCondition = 'c.display_number = $1';
    params.push(parseInt(value, 10));
  } else {
    return null;
  }

  const scopeCondition = ctx.projectId ? `c.project_id = $${params.length + 1}` : `p.client_id = $${params.length + 1}`;
  params.push(ctx.projectId ?? ctx.clientId);

  const selectClause = includeImages ? 'c.*' : LIGHT_COLUMNS;

  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const result = await client.query(
      `SELECT ${selectClause}, ${REF_EXPR} FROM comments c
       JOIN projects p ON c.project_id = p.id
       WHERE ${matchCondition} AND ${scopeCondition}`,
      params
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function mapRow(row: any): Ticket {
  return {
    id: row.id,
    uuid: row.uuid,
    ref: row.ref ?? null,
    display_number: row.display_number,
    url: row.url || '',
    page_section: row.page_section || '',
    status: row.status || 'open',
    priority: row.priority || 'low',
    priority_number: row.priority_number || 0,
    assignee: row.assignee || 'Unassigned',
    submitter_name: row.submitter_name || '',
    text_annotations: typeof row.text_annotations === 'string'
      ? JSON.parse(row.text_annotations)
      : (row.text_annotations || []),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    image_data: row.image_data || undefined,
  };
}
