import { CLIConfig, SuccessResponse, Ticket } from '../lib/types';
import { queryTicketByRef } from '../lib/db-reader';
import { fetchTicketByRef } from '../lib/api-client';

// A ticket reference is a ref ("LWF-12"), a uuid, or the bare number off the end
// of a ref (a human reading "LWF-12" naturally types "12" — resolved against the
// ref tail, never against an internal counter). Strip a leading '#'.
export function cleanRef(ref: string): string {
  const trimmed = ref.trim();
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
}

// Confirmation response for write commands (resolve/reopen/assign) — echoes the
// ref and the fields that changed. `id` is stripped by output before display.
export function ackResponse(mode: 'db' | 'api', fields: Partial<Ticket>): SuccessResponse {
  return {
    ok: true,
    mode,
    timestamp: new Date().toISOString(),
    filters: {},
    count: 1,
    tickets: [
      {
        id: 0,
        ref: null,
        url: '',
        page_section: '',
        status: '',
        priority: '',
        priority_number: 0,
        assignee: '',
        submitter_name: '',
        text_annotations: [],
        created_at: '',
        updated_at: '',
        ...fields,
      },
    ],
  };
}

export async function showCommand(
  config: CLIConfig,
  ref: string,
  includeImages: boolean = false
): Promise<SuccessResponse> {
  const cleaned = cleanRef(ref);
  if (!cleaned) throw new Error(`Invalid ticket reference: ${ref}`);

  const ticket = config.mode === 'db' && config.dbUrl
    ? await queryTicketByRef(config.dbUrl, config.token, cleaned, includeImages)
    : await fetchTicketByRef(config.apiUrl!, config.token, cleaned, includeImages);

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
