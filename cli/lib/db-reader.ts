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

export async function getClientIdByToken(dbUrl: string, token: string): Promise<number | null> {
  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const result = await client.query('SELECT id FROM clients WHERE token = $1', [token]);
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

export async function queryTickets(
  dbUrl: string,
  token: string,
  filters: TicketFilters,
  excludeImages: boolean = true
): Promise<Ticket[]> {
  const clientId = await getClientIdByToken(dbUrl, token);
  if (clientId === null) {
    throw new Error('Invalid token — no matching client found.');
  }

  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const selectClause = excludeImages
      ? "c.id, c.project_id, c.client_id, c.display_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at"
      : 'c.*';

    const conditions: string[] = ['p.client_id = $1'];
    const params: (string | number)[] = [clientId];
    let paramIdx = 2;

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
    if (filters.project) {
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
  const clientId = await getClientIdByToken(dbUrl, token);
  if (clientId === null) {
    throw new Error('Invalid token — no matching client found.');
  }

  const p = getPool(dbUrl);
  const client = await p.connect();
  try {
    const idColumn = byDisplayNumber ? 'c.display_number' : 'c.id';
    const selectClause = includeImages
      ? 'c.*'
      : "c.id, c.project_id, c.client_id, c.display_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.created_at, c.updated_at";

    const result = await client.query(
      `SELECT ${selectClause} FROM comments c
       JOIN projects p ON c.project_id = p.id
       WHERE p.client_id = $1 AND ${idColumn} = $2`,
      [clientId, ticketId]
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
