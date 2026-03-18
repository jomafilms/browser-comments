import { Ticket, TicketFilters } from './types';

export async function fetchTickets(
  apiUrl: string,
  token: string,
  filters: TicketFilters,
  excludeImages: boolean = true
): Promise<Ticket[]> {
  const url = new URL('/api/comments', apiUrl);
  url.searchParams.set('token', token);
  if (excludeImages) url.searchParams.set('excludeImages', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }

  let tickets: Ticket[] = await res.json();

  // Client-side filtering (API ignores filters when using token)
  if (filters.status) {
    tickets = tickets.filter(t => t.status === filters.status);
  }
  if (filters.priority) {
    tickets = tickets.filter(t => t.priority === filters.priority);
  }
  if (filters.assignee) {
    tickets = tickets.filter(t => (t.assignee || '').toLowerCase() === filters.assignee!.toLowerCase());
  }
  if (filters.section) {
    const section = filters.section.toLowerCase();
    tickets = tickets.filter(t => (t.page_section || '').toLowerCase().includes(section));
  }
  if (filters.project) {
    tickets = tickets.filter(t => (t as any).project_id === parseInt(filters.project!));
  }

  return tickets.map(mapTicket);
}

export async function fetchTicketById(
  apiUrl: string,
  token: string,
  ticketId: number,
  byDisplayNumber: boolean,
  includeImages: boolean = false
): Promise<Ticket | null> {
  const url = new URL('/api/comments', apiUrl);
  url.searchParams.set('token', token);
  if (!includeImages) url.searchParams.set('excludeImages', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }

  const tickets: Ticket[] = await res.json();
  const match = byDisplayNumber
    ? tickets.find(t => t.display_number === ticketId)
    : tickets.find(t => t.id === ticketId);

  return match ? mapTicket(match) : null;
}

export async function patchTicket(
  apiUrl: string,
  token: string,
  ticketId: number,
  body: Record<string, unknown>
): Promise<void> {
  const url = new URL(`/api/comments/${ticketId}`, apiUrl);
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
