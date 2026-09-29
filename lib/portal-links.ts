// Server-side client-portal URLs. One home for the link shape so the three
// places that hand out a ticket link — webhook payloads, notification emails,
// and the owner digest — can't drift apart. (The browser-side twin the admin
// UI uses is app/admin/links.ts, which reads window.location for its origin.)

/**
 * Deep link to one ticket in the client portal. `ref` is the ticket identity
 * ("LWF-12"), or a uuid for a legacy row that has none — the portal's ?c=
 * param resolves either, and won't let its default status filter hide the
 * ticket being linked to. Never a bare number: see THE ONE TICKET IDENTITY in
 * lib/db/refs. Without a client token there is no portal to link into, so fall
 * back to base.
 */
export function ticketLink(base: string, token: string | null | undefined, ref: string): string {
  return token ? `${base}/c/${token}/comments?c=${encodeURIComponent(ref)}` : base;
}
