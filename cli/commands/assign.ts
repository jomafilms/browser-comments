import { CLIConfig, CLIResponse } from '../lib/types';
import { patchTicket, resolveWriteTarget } from '../lib/api-client';
import { cleanRef, ackResponse } from './show';

export async function assignCommand(
  config: CLIConfig,
  ref: string,
  assignee: string
): Promise<CLIResponse> {
  if (!config.apiUrl) {
    throw new Error('BROWSER_COMMENTS_API is required for write operations. Set it in .env.local or as an environment variable.');
  }

  const cleaned = cleanRef(ref);
  if (!cleaned) throw new Error(`Invalid ticket reference: ${ref}`);

  const target = await resolveWriteTarget(config.apiUrl, config.token, cleaned);
  await patchTicket(config.apiUrl, config.token, target, { assignee });

  return ackResponse(config.mode, { ref: cleaned, assignee });
}
