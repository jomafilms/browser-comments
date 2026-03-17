import { CLIConfig, TicketFilters } from '../lib/types';
import { listCommand } from './list';
import { output } from '../lib/output';
import { resolveInterval, startSchedule } from '../lib/scheduler';

export function watchCommand(
  config: CLIConfig,
  filters: TicketFilters,
  format: string,
  schedule?: string,
  intervalSeconds?: number
): void {
  const seconds = resolveInterval(schedule, intervalSeconds);

  const tick = async () => {
    const result = await listCommand(config, filters);
    output(result, format);
  };

  const onError = (err: Error) => {
    output({ ok: false, error: err.message, code: 'WATCH_ERROR' }, format);
  };

  const { stop } = startSchedule(seconds, tick, onError);

  // Graceful shutdown
  const shutdown = () => {
    stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // If one-shot, exit after the first tick completes
  if (seconds <= 0) {
    tick().catch(onError).finally(() => process.exit(0));
  }
}
