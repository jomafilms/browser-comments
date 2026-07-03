import * as fs from 'fs';
import { CLIConfig, TicketFilters } from '../lib/types';
import { listCommand } from './list';
import { output } from '../lib/output';
import { resolveInterval, startSchedule } from '../lib/scheduler';

export function watchCommand(
  config: CLIConfig,
  filters: TicketFilters,
  format: string,
  schedule?: string,
  intervalSeconds?: number,
  sinceFile?: string
): void {
  const seconds = resolveInterval(schedule, intervalSeconds);

  // --since-file persists the last checkpoint (an ISO updated_at) so restarts
  // never re-emit a ticket. We advance it to the newest updated_at we emit —
  // data-derived, so there's no clock skew between the CLI and the server.
  const readCheckpoint = (): string | undefined => {
    if (!sinceFile) return undefined;
    try {
      const v = fs.readFileSync(sinceFile, 'utf-8').trim();
      return v || undefined;
    } catch {
      return undefined; // first run — no checkpoint yet
    }
  };
  const writeCheckpoint = (iso: string) => {
    if (sinceFile) fs.writeFileSync(sinceFile, iso);
  };

  const tick = async () => {
    if (sinceFile) {
      // Streaming mode: emit only new/changed tickets, one JSON object per line.
      const since = readCheckpoint();
      const result = await listCommand(config, { ...filters, since });
      let maxUpdated = since;
      for (const t of result.tickets) {
        const { id, ...rest } = t; // consumers act on ref/uuid, never the serial id
        void id;
        process.stdout.write(JSON.stringify(rest) + '\n');
        if (!maxUpdated || t.updated_at > maxUpdated) maxUpdated = t.updated_at;
      }
      if (maxUpdated && maxUpdated !== since) writeCheckpoint(maxUpdated);
    } else {
      // Default mode: emit the full list response each tick.
      const result = await listCommand(config, filters);
      output(result, format);
    }
  };

  const onError = (err: Error) => {
    output({ ok: false, error: err.message, code: 'WATCH_ERROR' }, format);
  };

  // startSchedule owns the tick (one-shot runs once then exits; interval runs
  // immediately + on schedule). No separate tick here — that was the double-emit.
  const { stop } = startSchedule(seconds, tick, onError, () => process.exit(0));

  // Graceful shutdown
  const shutdown = () => {
    stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
