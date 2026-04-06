export interface Ticket {
  id: number;
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
}

export async function fetchTickets(
  apiUrl: string,
  token: string,
  filters: TicketFilters,
  includeImages: boolean = false
): Promise<Ticket[]> {
  const url = new URL('/api/comments', apiUrl);
  url.searchParams.set('token', token);
  if (!includeImages) url.searchParams.set('excludeImages', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }

  let tickets: Ticket[] = await res.json();

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

  return tickets;
}

export async function fetchTicketById(
  apiUrl: string,
  token: string,
  ref: number,
  byDisplayNumber: boolean,
  includeImage: boolean = false
): Promise<Ticket | null> {
  const url = new URL('/api/comments', apiUrl);
  url.searchParams.set('token', token);
  if (!includeImage) url.searchParams.set('excludeImages', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API returned ${res.status}`);
  }

  const tickets: Ticket[] = await res.json();
  return byDisplayNumber
    ? tickets.find(t => t.display_number === ref) || null
    : tickets.find(t => t.id === ref) || null;
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
