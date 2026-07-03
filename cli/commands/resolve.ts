import { CLIConfig, CLIResponse } from '../lib/types';
import { patchTicket, resolveWriteTarget } from '../lib/api-client';
import { cleanRef, ackResponse } from './show';

export async function resolveCommand(
  config: CLIConfig,
  ref: string,
  note?: string
): Promise<CLIResponse> {
  if (!config.apiUrl) {
    throw new Error('BROWSER_COMMENTS_API is required for write operations. Set it in .env.local or as an environment variable.');
  }

  const cleaned = cleanRef(ref);
  if (!cleaned) throw new Error(`Invalid ticket reference: ${ref}`);

  const body: Record<string, unknown> = { status: 'resolved' };
  if (note) body.note = note;

  // ref/uuid PATCH directly; a bare number resolves once to its uuid first.
  const target = await resolveWriteTarget(config.apiUrl, config.token, cleaned);
  await patchTicket(config.apiUrl, config.token, target, body);

  return ackResponse(config.mode, { ref: cleaned, status: 'resolved' });
}
