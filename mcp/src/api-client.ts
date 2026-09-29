import { refTail, ambiguousRefError } from './refs';

// `ref` is the ONE ticket identity — the same string a human reads in the
// dashboard and in notification emails. `uuid` is the stable machine handle.
// There is deliberately no second number: a second number is a second answer to
// "which ticket?", which is how agents and humans ended up disagreeing.
export interface Ticket {
  id: number;
  uuid?: string;
  ref?: string | null; // "<PREFIX>-<project_number>", e.g. "LWF-12"
  url: string;
  page_section: string;
  status: string;
  priority: string;
  priority_number: number;
  assignee: string;
  submitter_name: string;
  text_annotations: { text: string; x: number; y: number; color: string }[];
  created_at: string;
  updated_at: string;
  image_data?: string;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  section?: string;
  since?: string; // ISO8601 — only tickets updated after this (polling)
}

export async function fetchTickets(
  apiUrl: string,
  token: string,
  filters: TicketFilters,
  includeImages: boolean = false
): Promise<Ticket[]> {
  const url = new URL('/api/comments', apiUrl);
  if (!includeImages) url.searchParams.set('excludeImages', 'true');
  // Filters are honored server-side on the token-scoped GET.
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.priority) url.searchParams.set('priority', filters.priority);
  if (filters.assignee) url.searchParams.set('assignee', filters.assignee);
  if (filters.section) url.searchParams.set('pageSection', filters.section);
  if (filters.since) url.searchParams.set('since', filters.since);

  // Token goes in the header, never the URL (avoids leaking via logs)
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }
  return await res.json();
}

// Fetch one ticket by ref ("LWF-12") or uuid — both resolve directly via the
// single-ticket endpoint (no scan). A bare number is a convenience only: it is
// matched against the REF TAIL via one scoped list lookup, and an ambiguous one
// is reported rather than guessed. The endpoint itself rejects bare numbers.
export async function fetchTicketByRef(
  apiUrl: string,
  token: string,
  ref: string,
  includeImage: boolean = false
): Promise<Ticket | null> {
  if (/^\d+$/.test(ref)) {
    const n = parseInt(ref, 10);
    // Resolve off an image-FREE list: this scan exists only to find the ref, and
    // include_image defaults to true, so scanning with images would download
    // every screenshot in the client's scope to answer "which ticket is 12?".
    const tickets = await fetchTickets(apiUrl, token, {}, false);
    const matches = tickets.filter(t => refTail(t.ref) === n);
    if (matches.length > 1) throw ambiguousRefError(ref, matches.map(t => t.ref));
    const resolved = matches[0];
    if (!resolved) return null;
    // Re-fetch the single ticket so the caller still gets its screenshot.
    return resolved.ref ? fetchTicketByRef(apiUrl, token, resolved.ref, includeImage) : resolved;
  }

  const url = new URL(`/api/comments/${encodeURIComponent(ref)}`, apiUrl);
  if (includeImage) url.searchParams.set('includeImage', 'true');

  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }
  return await res.json();
}

// Map a write target to something the endpoint accepts: a ref/uuid passes
// through; a bare number is resolved to the ticket's ref via one lookup,
// because the endpoint rejects bare numbers outright.
export async function resolveWriteTarget(
  apiUrl: string,
  token: string,
  ref: string
): Promise<string> {
  if (!/^\d+$/.test(ref)) return ref;
  const ticket = await fetchTicketByRef(apiUrl, token, ref);
  if (!ticket) throw new Error(`Ticket ${ref} not found.`);
  const target = ticket.ref ?? ticket.uuid;
  if (!target) throw new Error(`Ticket ${ref} has no ref or uuid; cannot safely target it.`);
  return target;
}

// PATCH by ref or uuid. Callers pass the output of resolveWriteTarget, never a
// bare number — the endpoint rejects those.
export async function patchTicket(
  apiUrl: string,
  token: string,
  ref: string,
  body: Record<string, unknown>
): Promise<void> {
  const url = new URL(`/api/comments/${encodeURIComponent(ref)}`, apiUrl);
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API PATCH returned ${res.status}`);
  }
}
