import { Pool } from 'pg';
import { Ticket, TicketFilters } from './types';

let pool: Pool | null = null;

function getPool(dbUrl: string): Pool {
  if (!pool) {
    const ssl = dbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined;
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
    const selectClause = excludeImages
      ? "c.id, c.project_id, c.client_id, c.display_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at"
      : 'c.*';

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

    const sql = `SELECT ${selectClause} FROM comments c
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

export async function queryTicketById(
  dbUrl: string,
  token: string,
  ticketId: number,
  byDisplayNumber: boolean,
  includeImages: boolean = false
): Promise<Ticket | null> {
  const ctx = await resolveTokenContext(dbUrl, token);
  if (!ctx) {
    throw new Error('Invalid token — no matching client or project found.');
  }

  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const idColumn = byDisplayNumber ? 'c.display_number' : 'c.id';
    const selectClause = includeImages
      ? 'c.*'
      : "c.id, c.project_id, c.client_id, c.display_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at";

    // Scope by project or client
    const scopeCondition = ctx.projectId
      ? 'c.project_id = $1'
      : 'p.client_id = $1';
    const scopeValue = ctx.projectId ?? ctx.clientId;

    const result = await client.query(
      `SELECT ${selectClause} FROM comments c
       JOIN projects p ON c.project_id = p.id
       WHERE ${scopeCondition} AND ${idColumn} = $2`,
      [scopeValue, ticketId]
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
