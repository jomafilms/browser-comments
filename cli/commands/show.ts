import { CLIConfig, SuccessResponse } from '../lib/types';
import { queryTicketById } from '../lib/db-reader';
import { fetchTicketById } from '../lib/api-client';

export function parseTicketRef(ref: string): { id: number; byDisplayNumber: boolean } {
  if (ref.startsWith('#')) {
    return { id: parseInt(ref.slice(1), 10), byDisplayNumber: true };
  }
  return { id: parseInt(ref, 10), byDisplayNumber: false };
}

export async function showCommand(
  config: CLIConfig,
  ref: string,
  includeImages: boolean = false
): Promise<SuccessResponse> {
  const { id, byDisplayNumber } = parseTicketRef(ref);
  if (isNaN(id)) throw new Error(`Invalid ticket reference: ${ref}`);

  const ticket = config.mode === 'db' && config.dbUrl
    ? await queryTicketById(config.dbUrl, config.token, id, byDisplayNumber, includeImages)
    : await fetchTicketById(config.apiUrl!, config.token, id, byDisplayNumber, includeImages);

  if (!ticket) throw new Error(`Ticket ${ref} not found.`);

  return {
    ok: true,
    mode: config.mode,
    timestamp: new Date().toISOString(),
    filters: {},
    count: 1,
    tickets: [ticket],
  };
}
