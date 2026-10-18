import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runId = 'habitzen-foundation-' + randomUUID().slice(0, 8);
const image = 'postgres:17-alpine';
let containerId;
const docker = (args, input) =>
  execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
try {
  docker(['version', '--format', '{{.Server.Version}}']);
  // NOTE: Изолированный контейнер без портов и сети; существующие базы и контейнеры не используются.
  containerId = docker([
    'run',
    '--detach',
    '--rm',
    '--network',
    'none',
    '--memory',
    '256m',
    '--label',
    'habitzen.test-run=' + runId,
    '--name',
    runId,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    image,
  ]).trim();
  if (!/^[a-f0-9]{64}$/.test(containerId))
    throw new Error('Не удалось определить созданный контейнер.');
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      docker(['exec', containerId, 'pg_isready', '-U', 'postgres']);
      ready = true;
      break;
    } catch {
      await new Promise((finish) => setTimeout(finish, 250));
    }
  }
  if (!ready) throw new Error('Временный PostgreSQL не стал готов за 20 секунд.');
  const execute = (source) =>
    docker(['exec', '-i', containerId, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], source);
  execute(await readFile(join(root, 'tests/database/auth-fixture.sql'), 'utf8'));
  const migrations = (await readdir(join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const migration of migrations)
    execute(await readFile(join(root, 'supabase/migrations', migration), 'utf8'));
  // NOTE: Все файлы проверок, кроме имитации Auth, выполняются по алфавиту в одной временной базе.
  const testFiles = (await readdir(join(root, 'tests/database')))
    .filter((name) => name.endsWith('.sql') && name !== 'auth-fixture.sql')
    .sort();
  let assertions = 0;
  let result = '';
  for (const file of testFiles) {
    const testSource = await readFile(join(root, 'tests/database', file), 'utf8');
    assertions += [...testSource.matchAll(/FAIL:/g)].length;
    result += execute(testSource);
  }
  const report = {
    status: 'PASS',
    runId,
    image,
    migrations,
    testFiles,
    assertions,
    scope: 'Изолированный PostgreSQL, тестовая имитация auth.uid',
    fullSupabase: 'NOT RUN',
    recordedAt: new Date().toISOString(),
    output: result,
  };
  await mkdir(join(root, 'storage/reports'), { recursive: true });
  await writeFile(
    join(root, 'storage/reports/database-foundation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    'PASS: ' +
      migrations.length +
      ' миграции и ' +
      assertions +
      ' проверок PostgreSQL; полный Supabase: NOT RUN.',
  );
} finally {
  if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
    const owner = docker([
      'inspect',
      '--format',
      '{{index .Config.Labels "habitzen.test-run"}}',
      containerId,
    ]).trim();
    if (owner === runId) docker(['rm', '--force', containerId]);
  }
}
