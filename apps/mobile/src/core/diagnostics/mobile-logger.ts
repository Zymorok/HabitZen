import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@habitzen/observability/logger';
import type { LogEvent, LogSink } from '@habitzen/observability/logger';

const LOG_KEY = 'habitzen.diagnostics.v1';
const MAX_EVENTS = 80;
let lostEvents = 0;
let tail: Promise<void> = Promise.resolve();
const sink: LogSink = {
  write(event: LogEvent): Promise<void> {
    const task = tail
      .catch(() => undefined)
      .then(async () => {
        const previous = await AsyncStorage.getItem(LOG_KEY);
        let events: unknown[] = [];
        if (previous) {
          try {
            const parsed: unknown = JSON.parse(previous);
            if (Array.isArray(parsed)) events = parsed;
          } catch {
            /* NOTE: Старый повреждённый журнал заменяется ограниченной новой очередью. */
          }
        }
        const next = [...events.slice(-(MAX_EVENTS - 1)), event];
        await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));
      });
    tail = task;
    return task;
  },
};
export const mobileLogger = createLogger({
  sink,
  runId: 'RUN-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
  now: () => new Date(),
  onSinkFailure: () => {
    lostEvents += 1;
  },
});
export function diagnosticsLostEvents(): number {
  return lostEvents;
}
