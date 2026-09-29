// Ticket-ref helpers for the CLI package. Mirrors lib/db/refs.ts in the app —
// this package is published standalone and cannot import from it, so the ref
// format lives here too. This file is a VERBATIM TWIN of mcp/src/refs.ts —
// change all three (lib/db/refs.ts, cli/lib/refs.ts, mcp/src/refs.ts) together.
//
// A ticket has exactly ONE number: its ref, "<PREFIX>-<project_number>", e.g.
// "LWF-12" — the same string the dashboard, emails and webhooks show. `uuid` is
// the stable machine handle. Nothing else identifies a ticket; the app used to
// carry a second per-client counter that disagreed with the ref, which is the
// mismatch this shared module exists to prevent recurring.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REF_RE = /^([A-Za-z][A-Za-z0-9]{0,7})-([0-9]+)$/;

// The numeric half of a ref: "LWF-12" → 12. Null for anything that isn't a ref.
export function refTail(ref: string | null | undefined): number | null {
  const m = REF_RE.exec((ref ?? '').trim());
  return m ? parseInt(m[2], 10) : null;
}

// Error for a bare number that ends more than one ref in the token's scope
// (a client token can span projects, so LWF-12 and EC-12 can both be "12").
// Shared so both read modes say the same thing.
export function ambiguousRefError(query: string | number, refs: (string | null | undefined)[]): Error {
  return new Error(`"${query}" matches ${refs.join(', ')} — pass the full ref.`);
}

// How a ticket is labelled in human-readable output: its ref, else a short uuid.
// Never a bare number — see the header. Mirrors formatCommentLabel in the app.
export function formatTicketLabel(
  ref: string | null | undefined,
  uuid: string | null | undefined
): string {
  if (ref) return ref;
  return uuid ? `#${uuid.slice(0, 8)}` : '#?';
}
