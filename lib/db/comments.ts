import { withClient } from './pool';
import { categorizeUA } from '../ua';
import { formatRef, isUuid, parseRef, refSelectSql } from './refs';
import { Comment, CommentFilters, TextAnnotation, TokenContext } from './types';

// Computed ref column — requires `LEFT JOIN projects p ON c.project_id = p.id`
const REF_SELECT = refSelectSql('p');

// Column list for image-free reads (image_data is by far the heaviest column)
const LIGHT_COLUMNS = `c.id, c.uuid, c.project_id, c.client_id, c.display_number, c.project_number, c.url, c.page_section, '' as image_data, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.user_agent, c.viewport_w, c.viewport_h, c.device_category, c.device_model, c.created_at, c.updated_at`;

// Helper to extract page section from URL path (returns raw path)
function extractPageSection(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (!path || path === '/') return 'Home';
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
  userAgent?: string;
  viewportW?: number;
  viewportH?: number;
  deviceCategory?: string;
  deviceModel?: string;
}): Promise<Comment> {
  return withClient(async (dbClient) => {
    // Get client_id + ref prefix from project if projectId is provided
    let clientId: number | null = null;
    let refPrefix: string | null = null;
    if (data.projectId) {
      const projectResult = await dbClient.query(
        'SELECT client_id, ref_prefix FROM projects WHERE id = $1',
        [data.projectId]
      );
      if (projectResult.rows.length > 0) {
        clientId = projectResult.rows[0].client_id;
        refPrefix = projectResult.rows[0].ref_prefix;
      }
    }

    const pageSection = data.pageSection || extractPageSection(data.url);

    // Derive category server-side if client didn't supply one but sent a UA
    const deviceCategory =
      data.deviceCategory || (data.userAgent ? categorizeUA(data.userAgent) : null);

    // display_number (legacy per-client, DEPRECATED — prefer ref) and
    // project_number are allocated inside the INSERT. Two concurrent inserts
    // can still compute the same MAX; the unique indexes turn that into a
    // 23505, which we retry once with freshly computed numbers.
    const insertSQL = `INSERT INTO comments (url, page_section, image_data, text_annotations, priority, priority_number, assignee, project_id, client_id, submitter_name, user_agent, viewport_w, viewport_h, device_category, device_model, display_number, project_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         CASE WHEN $9::int IS NULL THEN 1
              ELSE (SELECT COALESCE(MAX(display_number), 0) + 1 FROM comments WHERE client_id = $9) END,
         CASE WHEN $8::int IS NULL THEN NULL
              ELSE (SELECT COALESCE(MAX(project_number), 0) + 1 FROM comments WHERE project_id = $8) END)
       RETURNING *`;
    const params = [
      data.url,
      pageSection,
      data.imageData,
      JSON.stringify(data.textAnnotations),
      data.priority || 'med',
      data.priorityNumber || 0,
      data.assignee || 'Unassigned',
      data.projectId || null,
      clientId,
      data.submitterName || null,
      data.userAgent || null,
      data.viewportW || null,
      data.viewportH || null,
      deviceCategory,
      data.deviceModel || null,
    ];

    const MAX_ATTEMPTS = 3;
    let row;
    for (let attempt = 1; ; attempt++) {
      try {
        row = (await dbClient.query(insertSQL, params)).rows[0];
        break;
      } catch (err: unknown) {
        if ((err as { code?: string }).code !== '23505' || attempt >= MAX_ATTEMPTS) throw err;
      }
    }

    return { ...row, ref: formatRef(refPrefix, row.project_number) };
  });
}

export async function updateCommentStatus(id: number, status: 'open' | 'resolved'): Promise<void> {
  await withClient((client) =>
    // When resolving a comment, also reset priority_number to 0
    status === 'resolved'
      ? client.query(
          `UPDATE comments SET status = $1, priority_number = 0, updated_at = NOW() WHERE id = $2`,
          [status, id]
        )
      : client.query(
          `UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2`,
          [status, id]
        )
  );
}

export async function addNoteToComment(id: number, note: string): Promise<void> {
  await withClient((client) =>
    client.query(
      `UPDATE comments
       SET text_annotations = text_annotations || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ text: note, x: 0, y: 0, color: 'black' }]), id]
    )
  );
}

export async function deleteComment(id: number): Promise<void> {
  await withClient((client) => client.query(`DELETE FROM comments WHERE id = $1`, [id]));
}

export async function updateCommentPriority(
  id: number,
  priority: 'high' | 'med' | 'low',
  priorityNumber: number
): Promise<void> {
  await withClient((client) =>
    client.query(
      `UPDATE comments SET priority = $1, priority_number = $2, updated_at = NOW() WHERE id = $3`,
      [priority, priorityNumber, id]
    )
  );
}

export async function updateCommentAssignee(id: number, assignee: string): Promise<void> {
  await withClient((client) =>
    client.query(
      `UPDATE comments SET assignee = $1, updated_at = NOW() WHERE id = $2`,
      [assignee, id]
    )
  );
}

// Shared list query — project scope and client scope differ only in the base condition
async function queryComments(
  scope: { column: 'c.project_id' | 'p.client_id'; id: number },
  excludeImages?: boolean,
  filters?: CommentFilters
): Promise<Comment[]> {
  const selectClause = excludeImages ? LIGHT_COLUMNS : 'c.*';

  const conditions: string[] = [`${scope.column} = $1`];
  const params: (string | number)[] = [scope.id];
  let paramIdx = 2;

  if (filters?.status) {
    conditions.push(`c.status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters?.priority) {
    conditions.push(`c.priority = $${paramIdx++}`);
    params.push(filters.priority);
  }
  if (filters?.assignee) {
    conditions.push(`c.assignee = $${paramIdx++}`);
    params.push(filters.assignee);
  }
  if (filters?.pageSection) {
    conditions.push(`c.page_section ILIKE $${paramIdx++}`);
    params.push(`%${filters.pageSection}%`);
  }
  if (filters?.deviceCategory) {
    conditions.push(`c.device_category = $${paramIdx++}`);
    params.push(filters.deviceCategory);
  }
  if (filters?.since) {
    // Strictly greater so a poller checkpointing on the newest updated_at it
    // saw never re-emits that same row. updated_at is maintained on every
    // mutation (incl. batch-update), so this catches new + changed tickets.
    //
    // updated_at is `timestamp without time zone` written by NOW() in the DB
    // session tz. Reinterpreting it in that same tz (current_setting('TimeZone'))
    // recovers the true instant, which we compare against the ISO `since` as a
    // timestamptz — otherwise Postgres ignores the `Z` and compares mismatched
    // naive frames (off by the tz offset).
    //   API path: fully tz-safe — the checkpoint is X-Server-Time, a true UTC
    //   instant, and both sides here compare as true instants regardless of host tz.
    //   CLI DB-mode checkpoint (data-derived max(updated_at)) additionally assumes
    //   the CLI's Node tz matches the DB session tz (true locally; prod is UTC/UTC).
    // Truncate to milliseconds: ISO checkpoints (JS Date) are ms-precision but
    // the column is microsecond-precision, so an untruncated `>` re-emits the
    // exact boundary row (…806380 > …806000) forever. ms-vs-ms compares cleanly.
    conditions.push(
      `date_trunc('milliseconds', c.updated_at AT TIME ZONE current_setting('TimeZone')) > $${paramIdx++}::timestamptz`
    );
    params.push(filters.since);
  }

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT ${selectClause}, ${REF_SELECT} FROM comments c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE c.priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 WHEN 'low' THEN 3 END,
         c.priority_number DESC,
         c.created_at DESC`,
      params
    );
    return result.rows;
  });
}

// Get comments scoped by token context (project or client level)
export async function getCommentsByTokenContext(
  ctx: TokenContext,
  excludeImages?: boolean,
  filters?: CommentFilters
): Promise<Comment[]> {
  if (ctx.projectId) {
    return queryComments({ column: 'c.project_id', id: ctx.projectId }, excludeImages, filters);
  }
  return getCommentsByClientId(ctx.clientId, excludeImages, filters);
}

// Get comments by client ID (all projects for a client)
export async function getCommentsByClientId(
  clientId: number,
  excludeImages?: boolean,
  filters?: CommentFilters
): Promise<Comment[]> {
  return queryComments({ column: 'p.client_id', id: clientId }, excludeImages, filters);
}

// Fetch a single comment by its serial id, with the computed ref. image_data
// is excluded unless includeImage is set (it is by far the heaviest column).
export async function getCommentById(
  id: number,
  includeImage = false
): Promise<Comment | null> {
  const selectClause = includeImage ? 'c.*' : LIGHT_COLUMNS;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT ${selectClause}, ${REF_SELECT} FROM comments c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  });
}

// Verify comment ownership against a token context
export async function verifyCommentOwnershipByContext(
  ctx: TokenContext,
  commentId: number
): Promise<boolean> {
  return withClient(async (client) => {
    if (ctx.projectId) {
      // Project token: comment must belong to this specific project
      const result = await client.query(
        'SELECT id FROM comments WHERE id = $1 AND project_id = $2',
        [commentId, ctx.projectId]
      );
      return result.rows.length > 0;
    }
    // Client token: comment must belong to any project under this client
    const result = await client.query(
      'SELECT c.id FROM comments c JOIN projects p ON c.project_id = p.id WHERE c.id = $1 AND p.client_id = $2',
      [commentId, ctx.clientId]
    );
    return result.rows.length > 0;
  });
}

// Resolve a ticket reference within a token's scope. Accepts, in order:
// - a UUID (comments.uuid)
// - a ref like "LWF-12" (project prefix + project_number, case-insensitive)
// - a bare number, treated as the legacy per-client display_number
// Note: bare numbers here are NOT serial PKs — the /api/comments/[id] route
// keeps bare-integer params as PKs for back-compat and only delegates
// non-integer params to this helper.
// Returns the comment without image_data (fetch that separately by id).
export async function findCommentByRef(
  ctx: TokenContext,
  refOrNumber: string
): Promise<Comment | null> {
  const value = refOrNumber.trim();

  let condition: string;
  const params: (string | number)[] = [];
  if (isUuid(value)) {
    condition = `c.uuid = $1`;
    params.push(value);
  } else {
    const ref = parseRef(value);
    if (ref) {
      condition = `UPPER(p.ref_prefix) = $1 AND c.project_number = $2`;
      params.push(ref.prefix, ref.number);
    } else if (/^\d+$/.test(value) && parseInt(value, 10) <= 2147483647) {
      condition = `c.display_number = $1`;
      params.push(parseInt(value, 10));
    } else {
      return null;
    }
  }

  // Ref resolution never crosses the token's scope
  const scopeCondition = ctx.projectId
    ? `c.project_id = $${params.length + 1}`
    : `c.client_id = $${params.length + 1}`;
  params.push(ctx.projectId ?? ctx.clientId);

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT ${LIGHT_COLUMNS}, ${REF_SELECT} FROM comments c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE ${condition} AND ${scopeCondition}`,
      params
    );
    return result.rows[0] || null;
  });
}
