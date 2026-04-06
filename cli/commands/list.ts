import { CLIConfig, TicketFilters, SuccessResponse } from '../lib/types';
import { queryTickets } from '../lib/db-reader';
import { fetchTickets } from '../lib/api-client';

export async function listCommand(config: CLIConfig, filters: TicketFilters, includeImages: boolean = false): Promise<SuccessResponse> {
  const tickets = config.mode === 'db' && config.dbUrl
    ? await queryTickets(config.dbUrl, config.token, filters, !includeImages)
    : await fetchTickets(config.apiUrl!, config.token, filters, !includeImages);

  return {
    ok: true,
    mode: config.mode,
    timestamp: new Date().toISOString(),
    filters,
    count: tickets.length,
    tickets,
  };
}
