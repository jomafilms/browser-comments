import { withClient } from './pool';
import { categorizeUA } from '../ua';
import { formatRef } from './refs';
import { Comment, TextAnnotation } from './types';

// Write side of the comments module (split from comments.ts to keep both
// under the file-size cap). Reads/queries live in ./comments.

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
