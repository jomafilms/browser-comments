// Server-side client-portal URLs. One home for the link shape so the three
// places that hand out a ticket link — webhook payloads, notification emails,
// and the owner digest — can't drift apart. (The browser-side twin the admin
// UI uses is app/admin/links.ts, which reads window.location for its origin.)

/**
 * Deep link to one ticket in the client portal. `id` may be a ref ("LWF-12")
 * or a legacy display number — the portal's ?c= param resolves either, and
 * won't let its default status filter hide the ticket being linked to.
 * Without a client token there is no portal to link into, so fall back to base.
 */
export function ticketLink(base: string, token: string | null | undefined, id: string | number): string {
  return token ? `${base}/c/${token}/comments?c=${encodeURIComponent(String(id))}` : base;
}
