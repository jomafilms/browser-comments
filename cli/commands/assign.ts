import { CLIConfig, CLIResponse } from '../lib/types';
import { patchTicket, fetchTicketById } from '../lib/api-client';
import { queryTicketById } from '../lib/db-reader';
import { parseTicketRef } from './show';

export async function assignCommand(
  config: CLIConfig,
  ref: string,
  assignee: string
): Promise<CLIResponse> {
  if (!config.apiUrl) {
    throw new Error('BROWSER_COMMENTS_API is required for write operations. Set it in .env.local or as an environment variable.');
  }

  const { id, byDisplayNumber } = parseTicketRef(ref);
  if (isNaN(id)) throw new Error(`Invalid ticket reference: ${ref}`);

  let dbId = id;
  if (byDisplayNumber) {
    const ticket = config.dbUrl
      ? await queryTicketById(config.dbUrl, config.token, id, true)
      : await fetchTicketById(config.apiUrl, config.token, id, true);
    if (!ticket) throw new Error(`Ticket ${ref} not found.`);
    dbId = ticket.id;
  }

  await patchTicket(config.apiUrl, config.token, dbId, { assignee });

  return {
    ok: true,
    mode: config.mode,
    timestamp: new Date().toISOString(),
    filters: {},
    count: 1,
    tickets: [{ id: dbId, display_number: byDisplayNumber ? id : 0, url: '', page_section: '', status: '', priority: '', priority_number: 0, assignee, submitter_name: '', text_annotations: [], created_at: '', updated_at: '' }],
  };
}
