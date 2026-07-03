import { Ticket, TicketFilters } from './types';

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

// Fetch one ticket by ref ("LWF-12") / uuid / legacy number.
//  - ref & uuid resolve directly via the single-ticket endpoint (no scan).
//  - a BARE number means the legacy per-client display_number. The endpoint
//    treats bare integers as serial DB ids (dashboard contract), so we resolve
//    a display_number via one scoped list lookup instead. Prefer refs/uuids.
export async function fetchTicketByRef(
  apiUrl: string,
  token: string,
  ref: string,
  includeImages: boolean = false
): Promise<Ticket | null> {
  if (/^\d+$/.test(ref)) {
    return findByDisplayNumber(apiUrl, token, parseInt(ref, 10), !includeImages);
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

// One scoped list fetch to map a legacy display_number → its ticket.
async function findByDisplayNumber(
  apiUrl: string,
  token: string,
  displayNumber: number,
  excludeImages: boolean
): Promise<Ticket | null> {
  const tickets = await fetchTickets(apiUrl, token, {}, excludeImages);
  return tickets.find((t) => t.display_number === displayNumber) ?? null;
}

// Resolve a write target to something the endpoint accepts scan-free: a ref/uuid
// passes through; a bare display_number is mapped to its uuid via one lookup.
export async function resolveWriteTarget(
  apiUrl: string,
  token: string,
  ref: string
): Promise<string> {
  if (!/^\d+$/.test(ref)) return ref; // already a ref/uuid
  const ticket = await findByDisplayNumber(apiUrl, token, parseInt(ref, 10), true);
  if (!ticket) throw new Error(`Ticket ${ref} not found.`);
  // Must resolve to a uuid — falling back to the bare number would make the
  // endpoint treat it as a serial id (a different ticket). v4 always has a uuid.
  if (!ticket.uuid) throw new Error(`Ticket ${ref} has no uuid; cannot safely target it.`);
  return ticket.uuid;
}

// PATCH by ref / uuid / number — the single-ticket endpoint resolves + scope-checks it.
export async function patchTicket(
  apiUrl: string,
  token: string,
  ref: string | number,
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
    display_number: row.display_number,
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
