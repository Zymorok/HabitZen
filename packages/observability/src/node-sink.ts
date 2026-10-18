import { appendFile, mkdir, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { LogEvent, LogSink } from './logger.ts';

export class NodeFileSink implements LogSink {
  private tail: Promise<void> = Promise.resolve();
  private readonly root: string;
  private readonly timeZone: string;
  private readonly maxBytes: number;
  constructor(root: string, timeZone: string, maxBytes = 5 * 1024 * 1024) {
    this.root = root;
    this.timeZone = timeZone;
    this.maxBytes = maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024)
      throw new RangeError('Слишком малый размер лога.');
    new Intl.DateTimeFormat('en', { timeZone }).format();
  }
  write(event: LogEvent): Promise<void> {
    // NOTE: Один экземпляр владеет своим файлом; разные процессы получают разные runId.
    const work = this.tail.catch(() => undefined).then(() => this.append(event));
    this.tail = work;
    return work;
  }
  private async append(event: LogEvent): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(event.runId))
      throw new RangeError('Неверный идентификатор запуска.');
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(event.timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const day = value('day') + '.' + value('month') + '.' + value('year');
    for (const level of ['all', event.level]) {
      const directory = join(this.root, day, level);
      await mkdir(directory, { recursive: true });
      const path = join(directory, event.runId + '.jsonl');
      const line = JSON.stringify(event) + '\n';
      const size = await stat(path)
        .then((info) => info.size)
        .catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return 0;
          throw error;
        });
      if (size > 0 && size + Buffer.byteLength(line) > this.maxBytes) {
        // NOTE: Ротация ограничена тремя архивами на файл и не затрагивает другие запуски.
        await rm(path + '.3', { force: true });
        for (const part of [2, 1]) {
          await rename(path + '.' + part, path + '.' + (part + 1)).catch(
            (error: NodeJS.ErrnoException) => {
              if (error.code !== 'ENOENT') throw error;
            },
          );
        }
        await rename(path, path + '.1');
      }
      await appendFile(path, line, { encoding: 'utf8', mode: 0o600 });
    }
  }
}
export async function pruneLogs(root: string, now: Date, retentionDays = 14): Promise<number> {
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new RangeError('Неверный срок хранения.');
  const cutoff = now.getTime() - retentionDays * 86400000;
  const resolvedRoot = await realpath(root);
  let removed = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(entry.name);
    if (!match) continue;
    // NOTE: Удаляются только папки дат внутри явно переданного каталога логов.
    const instant = new Date(match[3] + '-' + match[2] + '-' + match[1] + 'T23:59:59Z').getTime();
    if (Number.isFinite(instant) && instant < cutoff) {
      const target = await realpath(join(resolvedRoot, entry.name));
      const withinRoot = relative(resolvedRoot, target);
      // WARNING: Перед удалением проверяется реальный абсолютный путь, включая переходы через ссылки.
      if (!withinRoot || withinRoot.startsWith('..') || isAbsolute(withinRoot)) continue;
      await rm(target, { recursive: true });
      removed += 1;
    }
  }
  return removed;
}
