// NOTE: HZ-07. Снимки всех 12 кадров макета в светлой и тёмной теме для README и сверки.
// HZ-11: плюс четыре экрана сверх макета (x1–x4): «Быстрый старт», «Порядок», итоги недели, медали.
// Нужны: локальный Supabase (`npm run db:start`) и приложение на http://localhost:8097.
// Затем `py resources/design/screens/make_gallery.py` собирает галерею в docs/screens.
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createDemoAccount, demoEmail, finishFocusSoon, holdAt } from './demo-account.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env['HABITZEN_BASE_URL'] ?? 'http://localhost:8097';
const outDir = join(root, 'storage', 'reports', 'screens');

async function capture(browser, scheme) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ru-RU',
    colorScheme: scheme,
    reducedMotion: 'no-preference',
  });
  const dir = join(outDir, scheme);
  await mkdir(dir, { recursive: true });
  const shot = async (name, wait = 1200) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: join(dir, `${name}.png`) });
    console.log(`${scheme}/${name}`);
  };
  const email = demoEmail(`screens-${scheme}`);

  await page.goto(baseURL);
  await page.getByTestId('onboarding-shell').waitFor();
  await shot('01-welcome', 2500);
  await createDemoAccount(page, baseURL, email, () => shot('03-new-habit', 600));
  // NOTE: Плашка «Новое достижение!» уходит сама через 5 с — кадр 02 снимаем без неё.
  await shot('02-today', 6000);

  await page.getByTestId('plan-row').filter({ hasText: 'Английский' }).click();
  await page.getByTestId('hold-screen').waitFor();
  await holdAt(page, 900);
  await shot('04-hold', 0);
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.getByTestId('done-screen').waitFor();
  await shot('05-done', 1500);
  await page.getByTestId('done-continue').click();
  await page.getByTestId('today-screen').waitFor();

  await page.getByTestId('tab-focus').click();
  await page.getByTestId('focus-main').click();
  await shot('06-focus', 2500);
  finishFocusSoon(email);
  await page.reload();
  await page
    .getByTestId('focus-title')
    .filter({ hasText: 'Пора отдохнуть' })
    .waitFor({ timeout: 15000 });
  await shot('07-break', 1500);

  await page.getByTestId('tab-progress').click();
  await page.getByTestId('progress-screen').waitFor();
  await shot('08-calendar', 1800);
  await page.getByTestId('progress-habit').filter({ hasText: 'Читать 20 минут' }).click();
  await page.getByTestId('habit-stats-screen').waitFor();
  await shot('09-habit', 1500);
  await page.getByTestId('habit-stats-back').click();

  await page.getByTestId('tab-today').click();
  await page.getByTestId('today-tree').click();
  await page.getByTestId('garden-screen').waitFor();
  await shot('10-tree', 1800);
  await page.getByTestId('garden-back').click();
  await page.getByTestId('plan-row').filter({ hasText: 'Медитация' }).click();
  await page.getByTestId('hold-screen').waitFor();
  await holdAt(page, 1500);
  await page.mouse.up();
  await page.getByTestId('done-continue').click();
  await page.getByTestId('celebration-screen').waitFor();
  await shot('11-celebration', 2200);
  await page.getByTestId('celebration-ok').click();

  await page.getByTestId('tab-profile').click();
  await page.getByTestId('profile-screen').waitFor();
  await shot('12-settings', 1500);

  // NOTE: Экраны сверх макета (HZ-08–10).
  await page.getByTestId('tab-today').click();
  await page.getByTestId('today-add').click();
  await page.getByTestId('habit-form').waitFor();
  await page.getByTestId('form-title').fill('Бег по утрам');
  await shot('x1-quick-start', 900);
  await page.getByTestId('form-back').click();
  await page.getByTestId('today-order').click();
  await shot('x2-order', 900);
  await page.getByTestId('today-order-done').click();
  await page.getByTestId('tab-progress').click();
  await page.getByTestId('open-week').click();
  await page.getByTestId('week-summary-screen').waitFor();
  await shot('x3-week', 1800);
  await page.getByTestId('week-back').click();
  await page.getByTestId('open-achievements').click();
  await page.getByTestId('achievements-screen').waitFor();
  await shot('x4-achievements', 1500);
  await page.close();
}

const browser = await chromium.launch(
  process.env['HABITZEN_CHROMIUM_PATH']
    ? { executablePath: process.env['HABITZEN_CHROMIUM_PATH'] }
    : {},
);
try {
  for (const scheme of ['light', 'dark']) await capture(browser, scheme);
} finally {
  await browser.close();
}
console.log(`PASS: снимки в ${outDir}`);
