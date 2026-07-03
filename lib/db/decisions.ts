import { withClient } from './pool';
import { refSelectSql } from './refs';
import { DecisionItem } from './types';

// The linked comment's ref so decision UIs can show "LWF-12".
// The alias must join the COMMENT's project (not the decision's).
const commentRefSelect = (alias: string) => refSelectSql(alias, 'comment_ref');

export async function addDecisionItem(
  noteText: string,
  commentId?: number | null,
  noteIndex?: number | null,
  source?: string | null,
  projectId?: number | null
): Promise<DecisionItem> {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO decision_items (comment_id, note_text, note_index, source, project_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [commentId || null, noteText, noteIndex || null, source || null, projectId || null]
    );
    return result.rows[0];
  });
}

export async function updateDecisionItem(
  id: number,
  noteText: string,
  source?: string | null
): Promise<DecisionItem> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE decision_items
       SET note_text = $1, source = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [noteText, source || null, id]
    );
    return result.rows[0];
  });
}

export async function deleteDecisionItem(id: number): Promise<void> {
  await withClient((client) => client.query(`DELETE FROM decision_items WHERE id = $1`, [id]));
}

export async function getDecisionItemsByCommentId(commentId: number): Promise<DecisionItem[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM decision_items WHERE comment_id = $1 ORDER BY note_index`,
      [commentId]
    );
    return result.rows;
  });
}

// Get decision items by project ID
export async function getDecisionItemsByProjectId(projectId: number): Promise<DecisionItem[]> {
  return withClient(async (client) => {
    // Match decisions explicitly tagged with this project, OR decisions
    // linked to a comment that belongs to this project (covers older items
    // created before project_id was passed on POST).
    // Also return the comment's display_number, project_id, and ref for the UI.
    const result = await client.query(
      `SELECT d.*, c.display_number as comment_display_number, c.project_id as comment_project_id, ${commentRefSelect('p')}
       FROM decision_items d
       LEFT JOIN comments c ON d.comment_id = c.id
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE d.project_id = $1
          OR (d.project_id IS NULL AND c.project_id = $1)
       ORDER BY d.created_at DESC`,
      [projectId]
    );
    return result.rows;
  });
}

// Get decision items by client ID
export async function getDecisionItemsByClientId(clientId: number): Promise<DecisionItem[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT d.*, c.display_number as comment_display_number, c.project_id as comment_project_id, ${commentRefSelect('cp')}
       FROM decision_items d
       LEFT JOIN comments c ON d.comment_id = c.id
       LEFT JOIN projects p ON COALESCE(d.project_id, c.project_id) = p.id
       LEFT JOIN projects cp ON c.project_id = cp.id
       WHERE p.client_id = $1
       ORDER BY d.created_at DESC`,
      [clientId]
    );
    return result.rows;
  });
}
