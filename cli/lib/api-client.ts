import { Ticket, TicketFilters } from './types';
import { refTail, ambiguousRefError } from './refs';

// Push list filters server-side (they are honored on the token-scoped GET —
// the old "API ignores filters" comment was stale). Only `project` stays
// client-side, since the API scopes by token, not by an explicit project param.
function applyFilterParams(url: URL, filters: TicketFilters): void {
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.priority) url.searchParams.set('priority', filters.priority);
  if (filters.assignee) url.searchParams.set('assignee', filters.assignee);
  if (filters.section) url.searchParams.set('pageSection', filters.section);
  if (filters.since) url.searchParams.set('since', filters.since);
}

export async function fetchTickets(
  apiUrl: string,
  token: string,
  filters: TicketFilters,
  excludeImages: boolean = true
): Promise<Ticket[]> {
  const url = new URL('/api/comments', apiUrl);
  if (excludeImages) url.searchParams.set('excludeImages', 'true');
  applyFilterParams(url, filters);

  // Token goes in the header, never the URL (avoids leaking via logs)
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }

  let tickets: Ticket[] = await res.json();

  // Only `project` isn't a server-side param (token scoping covers the rest).
  if (filters.project) {
    tickets = tickets.filter(t => (t as any).project_id === parseInt(filters.project!));
  }

  return tickets.map(mapTicket);
}

// Fetch one ticket by ref ("LWF-12") or uuid.
//  - ref & uuid resolve directly via the single-ticket endpoint (no scan).
//  - a BARE number is a convenience for humans who read "LWF-12" off the
//    dashboard and type "12". It is resolved against the REF TAIL via one
//    scoped list lookup — never sent to the endpoint, which rejects bare
//    numbers outright, and never matched against any internal counter.
export async function fetchTicketByRef(
  apiUrl: string,
  token: string,
  ref: string,
  includeImages: boolean = false
): Promise<Ticket | null> {
  if (/^\d+$/.test(ref)) {
    // Always scan image-FREE: this lookup exists only to find the ref. Then
    // re-fetch the one ticket so --include-images still gets its screenshot.
    const resolved = await findByRefTail(apiUrl, token, parseInt(ref, 10), true);
    if (!resolved) return null;
    if (!includeImages || !resolved.ref) return resolved;
    return fetchTicketByRef(apiUrl, token, resolved.ref, includeImages);
  }

  const url = new URL(`/api/comments/${encodeURIComponent(ref)}`, apiUrl);
  if (includeImages) url.searchParams.set('includeImage', 'true');

  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }
  return mapTicket(await res.json());
}

// One scoped list fetch to map a bare number → the ticket whose ref ends in it.
// A client-scoped token can span projects, so the same number may end two refs
// (LWF-12 and EC-12); that is reported, never guessed at.
async function findByRefTail(
  apiUrl: string,
  token: string,
  n: number,
  excludeImages: boolean
): Promise<Ticket | null> {
  const tickets = await fetchTickets(apiUrl, token, {}, excludeImages);
  const matches = tickets.filter((t) => refTail(t.ref) === n);
  if (matches.length > 1) throw ambiguousRefError(n, matches.map((t) => t.ref));
  return matches[0] ?? null;
}

// Resolve a write target to something the endpoint accepts: a ref/uuid passes
// through; a bare number is mapped to its ref via one lookup, because the
// endpoint rejects bare numbers (they used to be read as an internal row id,
// silently targeting a different ticket).
//
// The return value is what the write ACK echoes back, so it must always be a
// valid selector the caller can reuse. Echoing the caller's raw input instead
// would hand an agent back a bare number it can never use again.
export async function resolveWriteTarget(
  apiUrl: string,
  token: string,
  ref: string
): Promise<string> {
  if (!/^\d+$/.test(ref)) return ref; // already a ref/uuid
  const ticket = await findByRefTail(apiUrl, token, parseInt(ref, 10), true);
  if (!ticket) throw new Error(`Ticket ${ref} not found.`);
  // Prefer the ref itself; a uuid covers a legacy row that has none. Never the
  // bare number — the endpoint rejects it rather than guess.
  const target = ticket.ref ?? ticket.uuid;
  if (!target) throw new Error(`Ticket ${ref} has no ref or uuid; cannot safely target it.`);
  return target;
}

// PATCH by ref or uuid — the single-ticket endpoint resolves + scope-checks it.
// Callers pass the output of resolveWriteTarget, never a bare number.
export async function patchTicket(
  apiUrl: string,
  token: string,
  ref: string,
  body: Record<string, unknown>
): Promise<void> {
  const url = new URL(`/api/comments/${encodeURIComponent(String(ref))}`, apiUrl);
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

function mapTicket(row: any): Ticket {
  return {
    id: row.id,
    uuid: row.uuid,
    ref: row.ref ?? null,
    url: row.url || '',
    page_section: row.page_section || '',
    status: row.status || 'open',
    priority: row.priority || 'low',
    priority_number: row.priority_number || 0,
    assignee: row.assignee || 'Unassigned',
    submitter_name: row.submitter_name || '',
    text_annotations: typeof row.text_annotations === 'string'
      ? JSON.parse(row.text_annotations)
      : (row.text_annotations || []),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    image_data: row.image_data || undefined,
  };
}
