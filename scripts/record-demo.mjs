// NOTE: HZ-07. Видео-прохождение приложения в браузере (390×844) для превью в README:
// план дня → удержание → «Отлично!» → награда → дерево → фокус → календарь → тёмная тема.
// Нужны локальный Supabase и приложение на http://localhost:8097. Видео — storage/reports/video.
import { mkdir, readdir, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createDemoAccount, demoEmail, holdAt } from './demo-account.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env['HABITZEN_BASE_URL'] ?? 'http://localhost:8097';
const outDir = join(root, 'storage', 'reports', 'video');
const size = { width: 390, height: 844 };

const browser = await chromium.launch(
  process.env['HABITZEN_CHROMIUM_PATH']
    ? { executablePath: process.env['HABITZEN_CHROMIUM_PATH'] }
    : {},
);
await mkdir(outDir, { recursive: true });

// NOTE: Аккаунт с историей готовится без записи, видео начинается со входа.
const email = demoEmail('demo');
const setup = await browser.newPage({ viewport: size, locale: 'ru-RU' });
await createDemoAccount(setup, baseURL, email);
await setup.close();

const context = await browser.newContext({
  viewport: size,
  locale: 'ru-RU',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
  recordVideo: { dir: outDir, size },
});
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
try {
  await page.goto(baseURL);
  await page.getByTestId('onboarding-shell').waitFor();
  await pause(3500);
  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill('Habit-zen-2026');
  await pause(500);
  await page.getByTestId('sign-in-submit').click();
  await page.getByTestId('today-screen').waitFor();
  await pause(3000);

  for (const title of ['Английский', 'Медитация']) {
    await page.getByTestId('plan-row').filter({ hasText: title }).click();
    await page.getByTestId('hold-screen').waitFor();
    await pause(700);
    await holdAt(page, 1500);
    await page.mouse.up();
    await page.getByTestId('done-screen').waitFor();
    await pause(2500);
    await page.getByTestId('done-continue').click();
  }
  await page.getByTestId('celebration-screen').waitFor();
  await pause(4000);
  await page.getByTestId('celebration-ok').click();
  await page.getByTestId('today-screen').waitFor();
  await pause(1500);

  await page.getByTestId('today-tree').click();
  await page.getByTestId('garden-screen').waitFor();
  await pause(3500);
  await page.getByTestId('tab-focus').click();
  await pause(1200);
  await page.getByTestId('focus-main').click();
  await pause(3500);
  await page.getByTestId('tab-progress').click();
  await pause(3000);
  await page.getByTestId('progress-habit').filter({ hasText: 'Читать 20 минут' }).click();
  await pause(3000);
  await page.getByTestId('habit-stats-back').click();
  await page.getByTestId('tab-profile').click();
  await pause(2000);
  await page.getByRole('switch', { name: 'Тёмная тема' }).click();
  await pause(2500);
  await page.getByTestId('tab-today').click();
  await pause(3500);
} finally {
  await context.close();
  await browser.close();
}
const recorded = (await readdir(outDir)).filter((name) => name.endsWith('.webm'));
const latest = recorded.sort().at(-1);
if (latest) await rename(join(outDir, latest), join(outDir, 'habitzen-web-demo.webm'));
console.log(`PASS: ${join(outDir, 'habitzen-web-demo.webm')}`);
