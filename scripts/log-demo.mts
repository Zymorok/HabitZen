import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createLogger } from '../packages/observability/src/logger.ts';
import { NodeFileSink } from '../packages/observability/src/node-sink.ts';

const logger = createLogger({
  sink: new NodeFileSink(resolve('storage/logs'), 'Europe/Warsaw'),
  runId: 'RUN-' + randomUUID(),
  now: () => new Date(),
  onSinkFailure: () => {
    process.stderr.write('Не удалось сохранить диагностическое событие.\n');
  },
});
await logger.emit('info', 'system', 'foundation.ready', { status: 'PASS', schemaVersion: 1 });
process.stdout.write('PASS: событие сохранено в storage/logs.\n');
