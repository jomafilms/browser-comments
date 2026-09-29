import { CLIResponse } from './types';
import { formatTicketLabel } from './refs';

// Strip the internal db `id` from any tickets in the response so consumers
// (humans, agents) only ever see `ref` — the same identity the dashboard shows.
// Any second number is a second answer to "which ticket?"; that mismatch is the
// bug this exists to prevent.
function stripInternalIds(response: CLIResponse): CLIResponse {
  if (!response.ok) return response;
  return {
    ...response,
    tickets: response.tickets.map(t => {
      const copy: Record<string, unknown> = { ...t };
      delete copy.id;
      return copy as unknown as typeof t;
    }),
  };
}

export function formatJSON(response: CLIResponse): string {
  return JSON.stringify(stripInternalIds(response), null, 2);
}

export function formatText(response: CLIResponse): string {
  if (!response.ok) {
    return `Error [${response.code}]: ${response.error}`;
  }

  if (response.count === 0) {
    return 'No tickets found.';
  }

  const lines: string[] = [];
  const header = padRow(['Ref', 'Status', 'Priority', 'Assignee', 'Section', 'Annotation']);
  lines.push(header);
  lines.push('-'.repeat(header.length));

  for (const t of response.tickets) {
    const firstAnnotation = t.text_annotations?.[0]?.text || '';
    const annotation = firstAnnotation.length > 40 ? firstAnnotation.slice(0, 37) + '...' : firstAnnotation;
    lines.push(padRow([
      formatTicketLabel(t.ref, t.uuid),
      t.status,
      t.priority,
      t.assignee || 'Unassigned',
      t.page_section || '',
      annotation,
    ]));
  }

  lines.push('', `${response.count} ticket(s) | mode: ${response.mode}`);
  return lines.join('\n');
}

function padRow(cols: string[]): string {
  const widths = [10, 10, 10, 16, 20, 40];
  return cols.map((c, i) => c.padEnd(widths[i] || 20)).join(' ');
}

export function output(response: CLIResponse, format: string): void {
  const text = format === 'text' ? formatText(response) : formatJSON(response);
  process.stdout.write(text + '\n');
}

export function outputError(error: string, code: string, format: string): void {
  output({ ok: false, error, code }, format);
}
