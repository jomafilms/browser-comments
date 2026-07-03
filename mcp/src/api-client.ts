export interface Ticket {
  id: number;
  uuid?: string;
  ref?: string | null; // "<PREFIX>-<project_number>", e.g. "LWF-12"
  display_number: number;
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

// Fetch one ticket by ref ("LWF-12") / uuid / legacy number. ref & uuid resolve
// directly via the single-ticket endpoint (no scan); a bare number is the
// legacy display_number, resolved via one scoped list lookup (the endpoint
// treats bare integers as serial ids). Prefer refs/uuids.
export async function fetchTicketByRef(
  apiUrl: string,
  token: string,
  ref: string,
  includeImage: boolean = false
): Promise<Ticket | null> {
  if (/^\d+$/.test(ref)) {
    const tickets = await fetchTickets(apiUrl, token, {}, includeImage);
    return tickets.find(t => t.display_number === parseInt(ref, 10)) || null;
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

// Map a write target to something the endpoint accepts scan-free: ref/uuid pass
// through; a bare display_number is resolved to its uuid via one lookup.
export async function resolveWriteTarget(
  apiUrl: string,
  token: string,
  ref: string
): Promise<string> {
  if (!/^\d+$/.test(ref)) return ref;
  const ticket = await fetchTicketByRef(apiUrl, token, ref);
  if (!ticket) throw new Error(`Ticket ${ref} not found.`);
  // Must resolve to a uuid — a bare number would be read as a serial id (wrong ticket).
  if (!ticket.uuid) throw new Error(`Ticket ${ref} has no uuid; cannot safely target it.`);
  return ticket.uuid;
}

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
