import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Локальный показ итоговой веб-сборки (apps/mobile/dist).
 * NOTE: Приложение одностраничное: адреса /habits или /auth/callback не являются файлами.
 * Сервер отдаёт index.html на любой такой адрес — так же должен быть настроен хостинг.
 * `expo serve` так не умеет и отвечает «Not Found» на прямую ссылку из письма.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/mobile/dist');
const portIndex = process.argv.indexOf('--port');
const port = portIndex > 0 ? Number(process.argv[portIndex + 1]) : 8098;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(root, '.' + normalize(decoded));
  // WARNING: Защита от выхода за пределы dist через «../» в адресе.
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    /* NOTE: Файла нет — это адрес экрана приложения. */
  }
  return null;
}

createServer(async (request, response) => {
  try {
    const file = (await fileFor(request.url ?? '/')) ?? join(root, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Сборка не найдена: сначала npm run export:web');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`HabitZen (итоговая веб-сборка): http://localhost:${port}`);
});
