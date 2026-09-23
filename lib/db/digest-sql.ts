// Shared SQL for both digests — the per-client one (lib/db/notifications.ts)
// and the cross-client owner one (lib/db/owner-digest.ts). They ask the same
// question over the same window and differ only in scope and projection, so the
// window lives here once rather than being copy-edited in two places.
//
// The arguments are SQL PLACEHOLDER NAMES ('$1', '$2'), written by the call
// site — never user input. Each query numbers its own binds, which is why this
// is parameterized by name instead of being a fixed string.

export interface DigestWindowSql {
  /** The window's start boundary: the last digest, or `interval` ago on the first run. */
  boundary: string;
  /** Rows created in the window, or resolved in it. */
  where: string;
  /** 'created' vs 'resolved', decided DB-side against the same boundary. */
  kindSelect: string;
}

export function digestWindowSql(sinceParam: string, intervalParam: string): DigestWindowSql {
  const boundary = `COALESCE(${sinceParam}::timestamp, NOW() - ${intervalParam}::interval)`;
  return {
    boundary,
    where: `(c.created_at > ${boundary}
             OR (c.status = 'resolved' AND c.updated_at > ${boundary}))`,
    // Computed in SQL against the same boundary the WHERE used. Deriving this
    // in JS got the FIRST-EVER digest wrong: with no checkpoint yet there is no
    // `since` to compare against, so every row — including old tickets that
    // only matched the resolved arm — was announced as "new".
    // A ticket both created and resolved in-window counts as 'created' (new work).
    kindSelect: `CASE WHEN c.created_at > ${boundary} THEN 'created' ELSE 'resolved' END AS kind`,
  };
}
