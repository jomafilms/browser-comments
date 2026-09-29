import { withClient } from './pool';
import { parseTicketSelector, refSelectSql } from './refs';
import { Comment, CommentFilters, TokenContext } from './types';

// Read/query side of the comments module. Writes (saveComment + the small
// UPDATE/DELETE helpers) live in ./comments-write.

// Computed ref column — requires `LEFT JOIN projects p ON c.project_id = p.id`
const REF_SELECT = refSelectSql('p');

// Every column we expose, minus image_data (by far the heaviest). Explicit —
// never `c.*` — so the dead `display_number` column cannot leak into a
// response by accident. See THE ONE TICKET IDENTITY in ./refs.
const BASE_COLUMNS = `c.id, c.uuid, c.project_id, c.client_id, c.project_number, c.url, c.page_section, c.text_annotations, c.status, c.priority, c.priority_number, c.assignee, c.submitter_name, c.user_agent, c.viewport_w, c.viewport_h, c.device_category, c.device_model, c.created_at, c.updated_at`;

// Image-free reads still carry an empty image_data so the shape never varies.
const LIGHT_COLUMNS = `${BASE_COLUMNS}, '' as image_data`;
const FULL_COLUMNS = `${BASE_COLUMNS}, c.image_data`;

// Tickets not attached to any project are invisible to every token scope —
// the admin dashboard shows a warning when any exist (legacy data only; the
// widget always resolves a project now).
export async function countOrphanComments(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT COUNT(*)::int AS n FROM comments WHERE project_id IS NULL`
    );
    return result.rows[0].n;
  });
}

// Shared list query — project scope and client scope differ only in the base condition
async function queryComments(
  scope: { column: 'c.project_id' | 'p.client_id'; id: number },
  excludeImages?: boolean,
  filters?: CommentFilters
): Promise<Comment[]> {
  const selectClause = excludeImages ? LIGHT_COLUMNS : FULL_COLUMNS;

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
  const selectClause = includeImage ? FULL_COLUMNS : LIGHT_COLUMNS;
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

// Resolve a ticket selector within a token's scope. Accepts a ref like
// "LWF-12" (case-insensitive) or a uuid — and nothing else. Bare numbers are
// rejected by parseTicketSelector rather than resolved against some counter:
// see THE ONE TICKET IDENTITY in ./refs for why that used to return the wrong
// ticket. Callers that want to tell a bad selector from a missing ticket should
// call parseTicketSelector themselves first.
// Returns the comment without image_data (fetch that separately by id).
export async function findCommentByRef(
  ctx: TokenContext,
  selector: string
): Promise<Comment | null> {
  const parsed = parseTicketSelector(selector);

  let condition: string;
  const params: (string | number)[] = [];
  if (parsed.kind === 'uuid') {
    condition = `c.uuid = $1`;
    params.push(parsed.uuid);
  } else if (parsed.kind === 'ref') {
    condition = `UPPER(p.ref_prefix) = $1 AND c.project_number = $2`;
    params.push(parsed.prefix, parsed.number);
  } else {
    return null;
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
