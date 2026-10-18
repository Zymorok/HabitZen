import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: Инструмент касается только собственного приложения и выбранного тестового устройства.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sdk = process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT'];
const adb =
  process.env['HABITZEN_ADB_PATH'] ??
  (sdk ? join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb');
const device = process.env['HABITZEN_DEVICE'] ?? 'emulator-5554';
const output = join(root, 'storage/reports/native');
const app = 'app.habitzen.mobile';
const [action, value = 'screen'] = process.argv.slice(2);
const command = (...args) =>
  execFileSync(adb, ['-s', device, ...args], { maxBuffer: 20 * 1024 * 1024 });

function dump() {
  // NOTE: Уникальное имя исключает чтение старого окна, если ОС не дождалась покоя анимации.
  const windowFile = '/sdcard/habitzen-test-window-' + Date.now() + '.xml';
  command('shell', 'uiautomator', 'dump', windowFile);
  const xml = command('exec-out', 'cat', windowFile).toString('utf8');
  if (!xml.includes('<node'))
    throw new Error(
      'ОС вернула пустое окно; дождитесь интерфейса и уменьшите движение на тестовом эмуляторе.',
    );
  return xml;
}

if (action === 'launch') {
  if (!['home', 'permissions'].includes(value)) throw new Error('Допустимы home или permissions.');
  command(
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    value === 'home' ? 'habitzen:///' : 'habitzen:///permissions',
    app,
  );
} else if (action === 'snapshot') {
  if (!/^[a-z0-9-]+$/.test(value)) throw new Error('Имя снимка: латинские буквы, цифры и дефис.');
  mkdirSync(output, { recursive: true });
  const xml = dump();
  writeFileSync(join(output, value + '.png'), command('exec-out', 'screencap', '-p'));
  writeFileSync(join(output, value + '.xml'), xml);
  console.log(xml);
} else if (action === 'tap-id' || action === 'tap-text') {
  const nodes = [...dump().matchAll(/<node\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, text]) => [key, text]),
    ),
  );
  const target = nodes.find((node) =>
    action === 'tap-id'
      ? node['resource-id'] === value || node['resource-id']?.endsWith('/' + value)
      : node['text'] === value || node['content-desc'] === value,
  );
  const bounds = target?.['bounds']?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!bounds) throw new Error('Элемент не найден: ' + value);
  const [, left, top, right, bottom] = bounds.map(Number);
  command(
    'shell',
    'input',
    'tap',
    String(Math.round((left + right) / 2)),
    String(Math.round((top + bottom) / 2)),
  );
} else {
  throw new Error('Команды: launch home|permissions, snapshot имя, tap-id ID, tap-text текст.');
}
