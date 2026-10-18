export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogArea = 'system' | 'auth' | 'habits' | 'focus' | 'progress' | 'data';
export interface LogEvent {
  readonly schemaVersion: 1;
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly area: LogArea;
  readonly event: string;
  readonly runId: string;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
}
export interface LogSink {
  write(event: LogEvent): Promise<void>;
}
const allowedFields = new Set([
  'requestId',
  'durationMs',
  'count',
  'revision',
  'status',
  'code',
  'retryCount',
  'appVersion',
  'schemaVersion',
]);
export function sanitizeFields(
  fields: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    // NOTE: Список разрешений безопаснее удаления только известных паролей и токенов.
    if (!allowedFields.has(key)) continue;
    if (value === null || typeof value === 'boolean') result[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'string' && /^[a-zA-Z0-9_.:/ -]{0,100}$/.test(value)) {
      result[key] = value;
    }
  }
  return result;
}
export function createLogger(options: {
  readonly sink: LogSink;
  readonly runId: string;
  readonly now: () => Date;
  readonly onSinkFailure: () => void;
}) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(options.runId))
    throw new RangeError('Неверный идентификатор запуска.');
  return {
    async emit(
      level: LogLevel,
      area: LogArea,
      event: string,
      fields: Readonly<Record<string, unknown>> = {},
    ): Promise<void> {
      if (!/^[a-z][a-z0-9_.]{1,100}$/.test(event)) throw new RangeError('Неверный код события.');
      const record: LogEvent = {
        schemaVersion: 1,
        timestamp: options.now().toISOString(),
        level,
        area,
        event,
        runId: options.runId,
        fields: sanitizeFields(fields),
      };
      try {
        await options.sink.write(record);
      } catch {
        // NOTE: Ошибка записи лога не меняет результат пользовательского действия.
        options.onSinkFailure();
      }
    },
  };
}
