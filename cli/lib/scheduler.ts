const PRESETS: Record<string, number> = {
  manual: 0,
  never: 0,
  hourly: 3600,
  daily: 86400,
  weekly: 604800,
};

export function resolveInterval(schedule?: string, intervalSeconds?: number): number {
  if (intervalSeconds !== undefined && intervalSeconds > 0) return intervalSeconds;
  if (schedule && PRESETS[schedule] !== undefined) return PRESETS[schedule];
  return 0; // one-shot
}

// Owns ALL ticking — callers must not run the first tick themselves (that was
// the old double-emit bug). One-shot runs exactly once, then calls
// onOneShotDone so the caller can exit cleanly.
export function startSchedule(
  intervalSeconds: number,
  tick: () => Promise<void>,
  onError: (err: Error) => void,
  onOneShotDone?: () => void
): { stop: () => void } {
  if (intervalSeconds <= 0) {
    // One-shot: run once, then signal completion.
    tick()
      .catch(onError)
      .finally(() => onOneShotDone?.());
    return { stop: () => {} };
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  // Run immediately, then on interval
  tick().catch(onError);
  timer = setInterval(() => {
    tick().catch(onError);
  }, intervalSeconds * 1000);

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
