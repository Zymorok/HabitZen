import { mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogger, sanitizeFields } from '../../packages/observability/src/logger.ts';
import { NodeFileSink, pruneLogs } from '../../packages/observability/src/node-sink.ts';

async function withTemporaryDirectory(test: (root: string) => Promise<void>) {
  const base = await realpath(tmpdir());
  const root = await mkdtemp(join(base, 'habitzen-logging-'));
  try {
    await test(root);
  } finally {
    const actual = await realpath(root);
    const child = relative(base, actual);
    // WARNING: Тест удаляет только собственный временный каталог с проверенным абсолютным путём.
    if (!child.startsWith('habitzen-logging-') || child.includes('..') || isAbsolute(child)) {
      throw new Error('Небезопасный путь очистки теста.');
    }
    await rm(actual, { recursive: true });
  }
}

describe('Безопасные диагностические события', () => {
  it('не сохраняет пароль, почту, текст привычки и сырое исключение', () => {
    const fields = sanitizeFields({
      requestId: 'request-1',
      count: 3,
      password: 'SECRET',
      email: 'owner@example.com',
      title: 'Личная привычка',
      error: new Error('SECRET'),
    });
    expect(fields).toEqual({ requestId: 'request-1', count: 3 });
  });
  it('не превращает сбой логов в ошибку действия пользователя', async () => {
    let failures = 0;
    const logger = createLogger({
      sink: {
        write: async () => {
          throw new Error('Нет места');
        },
      },
      now: () => new Date('2026-10-17T23:00:00Z'),
      runId: 'RUN-test',
      onSinkFailure: () => {
        failures += 1;
      },
    });
    await expect(logger.emit('info', 'habits', 'habit.completed')).resolves.toBeUndefined();
    expect(failures).toBe(1);
  });
  it('не принимает идентификатор запуска с выходом из папки', () => {
    expect(() =>
      createLogger({
        sink: { write: async () => undefined },
        now: () => new Date(),
        runId: '../outside',
        onSinkFailure: () => undefined,
      }),
    ).toThrow();
  });
  it('сохраняет дату по указанному часовому поясу и все параллельные события', async () => {
    await withTemporaryDirectory(async (root) => {
      const logger = createLogger({
        sink: new NodeFileSink(root, 'Europe/Warsaw'),
        now: () => new Date('2026-10-17T23:00:00Z'),
        runId: 'RUN-test',
        onSinkFailure: () => {
          throw new Error('Сбой записи');
        },
      });
      await Promise.all(
        Array.from({ length: 20 }, (_, count) =>
          logger.emit('info', 'system', 'test.event', { count }),
        ),
      );
      const source = await readFile(join(root, '18.10.2026/all/RUN-test.jsonl'), 'utf8');
      expect(source.trim().split('\n')).toHaveLength(20);
      expect(await readFile(join(root, '18.10.2026/info/RUN-test.jsonl'), 'utf8')).toBe(source);
    });
  });
  it('ограничивает количество файлов ротации', async () => {
    await withTemporaryDirectory(async (root) => {
      const logger = createLogger({
        sink: new NodeFileSink(root, 'UTC', 1024),
        now: () => new Date('2026-10-17T12:00:00Z'),
        runId: 'RUN-rotate',
        onSinkFailure: () => {
          throw new Error('Сбой записи');
        },
      });
      for (let count = 0; count < 60; count += 1) {
        await logger.emit('info', 'system', 'test.rotation', { requestId: 'x'.repeat(80), count });
      }
      expect(await readdir(join(root, '17.10.2026/all'))).toHaveLength(4);
    });
  });
  it('очищает только старые папки дат, сохраняя остальные рабочие данные', async () => {
    await withTemporaryDirectory(async (root) => {
      await mkdir(join(root, '01.09.2026'));
      await mkdir(join(root, '17.10.2026'));
      await mkdir(join(root, 'runtime'));
      await writeFile(join(root, 'runtime/keep.txt'), 'Сохранить');
      expect(await pruneLogs(root, new Date('2026-10-17T12:00:00Z'), 14)).toBe(1);
      expect(await readdir(root)).toEqual(expect.arrayContaining(['17.10.2026', 'runtime']));
    });
  });
});
