import { withClient } from './pool';
import { refSelectSql, joinAnnotationTexts } from './refs';
import { digestWindowSql } from './digest-sql';

// The OWNER digest: one cross-client roll-up for the operator running this
// instance. Distinct from lib/db/notifications.ts, whose digest is per-client
// and addressed to the client — this one answers "what came in anywhere today?"
// in a single email, so the operator isn't reading one message per client.
//
// The checkpoint is instance-wide (instance_settings.last_owner_digest_at, v7),
// and — like the per-client digest — due-ness is computed DB-side so the naive
// timestamp never round-trips through JS and shifts timezone.

export interface OwnerDigestCheckpoint {
  since: string | null; // last send as a naive wall-clock string (DB tz), null if never
  dailyWindowOk: boolean; // ≥ ~20h since the last send — pair with the local-hour check
}

export async function getOwnerDigestCheckpoint(): Promise<OwnerDigestCheckpoint> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT last_owner_digest_at::text AS since,
              (last_owner_digest_at IS NULL OR last_owner_digest_at < NOW() - INTERVAL '20 hours') AS daily_window_ok
       FROM instance_settings WHERE id = 1`
    );
    const row = result.rows[0];
    // No instance_settings row yet (pre-init) → treat as never sent.
    return { since: row?.since ?? null, dailyWindowOk: row ? row.daily_window_ok : true };
  });
}

// Upsert, not a bare UPDATE: if the singleton row were ever missing, an UPDATE
// would match zero rows and the checkpoint would never advance — re-sending the
// same window forever. Mirrors setBranding()'s pattern.
export async function touchOwnerDigestAt(): Promise<void> {
  await withClient((client) =>
    client.query(
      `INSERT INTO instance_settings (id, last_owner_digest_at) VALUES (1, NOW())
       ON CONFLICT (id) DO UPDATE SET last_owner_digest_at = NOW()`
    )
  );
}

export interface OwnerDigestItem {
  clientId: number | null;
  clientName: string | null; // null for orphan tickets (no client) — surfaced, never dropped
  clientToken: string | null;
  projectId: number | null;
  projectName: string | null;
  ref: string | null;
  displayNumber: number | null;
  pageSection: string;
  submitterName: string | null;
  note: string | null; // the widget's text annotations, joined
  kind: 'created' | 'resolved';
}

// Every ticket created OR resolved across every client since `since`. When
// `since` is null (first ever owner digest) we bound it to `fallbackInterval`
// so the first email isn't the entire history.
//
// clients is LEFT JOINed on purpose: a ticket with a NULL client_id (legacy
// orphan) still appears, grouped as "Unassigned", instead of silently missing
// from the one email that is supposed to catch everything.
// One email can't carry an unbounded day. Without a cap a very busy day builds
// a message the provider may reject for size — and since a failed send leaves
// the checkpoint unadvanced, the next run would rebuild the same (larger)
// window and fail again, forever. Cap the lines and say so in the email.
export const OWNER_DIGEST_MAX_ITEMS = 200;

export interface OwnerDigestPage {
  items: OwnerDigestItem[];
  truncated: boolean;
}

export async function getOwnerDigestItems(
  since: string | null,
  fallbackInterval: string
): Promise<OwnerDigestPage> {
  const REF_SELECT = refSelectSql('p');
  const window = digestWindowSql('$1', '$2');
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT c.client_id, cl.name AS client_name, cl.token AS client_token,
              c.project_id, p.name AS project_name,
              c.display_number, c.page_section, c.submitter_name,
              c.text_annotations, ${REF_SELECT}, ${window.kindSelect}
       FROM comments c
       LEFT JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE ${window.where}
       ORDER BY cl.name NULLS LAST, p.name NULLS LAST, c.created_at DESC
       LIMIT $3`,
      [since, fallbackInterval, OWNER_DIGEST_MAX_ITEMS + 1]
    );
    // One row over the cap is the truncation signal; it never reaches the email.
    const truncated = result.rows.length > OWNER_DIGEST_MAX_ITEMS;
    const rows = truncated ? result.rows.slice(0, OWNER_DIGEST_MAX_ITEMS) : result.rows;
    return {
      truncated,
      items: rows.map((r) => ({
        clientId: r.client_id,
        clientName: r.client_name,
        clientToken: r.client_token,
        projectId: r.project_id,
        projectName: r.project_name,
        ref: r.ref,
        displayNumber: r.display_number ?? null,
        pageSection: r.page_section,
        submitterName: r.submitter_name,
        note: joinAnnotationTexts(r.text_annotations),
        kind: r.kind as 'created' | 'resolved',
      })),
    };
  });
}
