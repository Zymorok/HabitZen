import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function artworkReady(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  // NOTE: Системный язык браузера задан в конфигурации; хранилище каждого теста изолировано.
  await page.goto('/');
  await expect(page.getByTestId('start-button')).toBeVisible();
  await artworkReady(page);
});

test('первый экран, безопасные кнопки и отсутствие ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.reload();
  await expect(page.getByTestId('start-button')).toBeVisible();
  await expect(page.getByTestId('onboarding-page-0')).toContainText('Расти в своём ритме');
  await expect(page.getByTestId('start-button')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('account-button')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('page-dot-0')).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'storage/reports/e2e/welcome-light-ru.png' });
});

test('язык и тема сохраняются после перезапуска', async ({ page }) => {
  await page.getByTestId('language-button').click();
  await page.getByTestId('language-option-en').click();
  await expect(page.getByTestId('language-option-en')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('preferences-tab-theme').click();
  await page.getByTestId('theme-option-dark').click();
  await expect(page.getByTestId('theme-option-dark')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('sheet-close').click();
  await expect(page.getByTestId('start-button')).toContainText('Get started');
  await expect(page.getByTestId('onboarding-shell')).toHaveCSS(
    'background-color',
    'rgb(20, 35, 30)',
  );
  await page.reload();
  await expect(page.getByTestId('start-button')).toContainText('Get started');
  await expect(page.getByTestId('onboarding-shell')).toHaveCSS(
    'background-color',
    'rgb(20, 35, 30)',
  );
  await page.screenshot({ path: 'storage/reports/e2e/welcome-dark-en.png' });
  await page.getByTestId('language-button').click();
  await page.getByTestId('language-option-uk').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('onboarding-page-0')).toContainText('ритмі');
  await page.screenshot({ path: 'storage/reports/e2e/welcome-dark-uk.png' });
});

test('пять страниц и объяснение разрешения без запроса при открытии', async ({ page }) => {
  const initialPermission = await page.evaluate(() => Notification.permission);
  for (let index = 1; index < 5; index++) {
    await page.getByTestId('page-dot-' + index).click();
    await expect(page.getByTestId('page-dot-' + index)).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `storage/reports/e2e/intro-${index}.png` });
  }
  await page.getByTestId('reminders-button').click();
  await expect(page.getByTestId('permission-primary')).toBeVisible();
  await artworkReady(page);
  expect(await page.evaluate(() => Notification.permission)).toBe(initialPermission);
  await page.screenshot({ path: 'storage/reports/e2e/permission-explanation.png' });
  await page.getByTestId('permission-later').click();
  await expect(page.getByTestId('permission-sheet')).toHaveCount(0);
  await page.getByTestId('reminders-button').click();
  await page.getByTestId('permission-primary').click();
  await expect(page.getByTestId('permission-sheet')).toContainText('На телефоне');
  await expect(page.getByTestId('permission-dismiss')).toBeVisible();
  await page.screenshot({ path: 'storage/reports/e2e/permission-web-guidance.png' });
  await page.getByTestId('permission-dismiss').click();
  await expect(page.getByTestId('start-button')).toBeVisible();
});

test('маленький экран и широкое окно не обрезают управление', async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const id of [
      'language-button',
      'theme-button',
      'start-button',
      'account-button',
      'page-dot-4',
    ]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `storage/reports/e2e/viewport-${viewport.width}.png` });
  }
});

test('системная тема и ручной выбор имеют правильный приоритет', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('onboarding-shell')).toHaveCSS(
    'background-color',
    'rgb(20, 35, 30)',
  );
  await page.getByTestId('theme-button').click();
  await page.getByTestId('theme-option-light').click();
  await page.getByTestId('sheet-close').click();
  await expect(page.getByTestId('onboarding-shell')).toHaveCSS(
    'background-color',
    'rgb(251, 248, 239)',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('onboarding-shell')).toHaveCSS(
    'background-color',
    'rgb(251, 248, 239)',
  );
});

test('живые эффекты останавливаются при уменьшении движения', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // NOTE: Листья ростка качаются от общего «ветра» сцены.
  const sprout = page.getByTestId('world-sprout-sway');
  const initial = await sprout.evaluate((element) => getComputedStyle(element).transform);
  await expect
    .poll(() => sprout.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initial);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // NOTE: Даём сцене один кадр на остановку часов, затем проверяем, что она стоит.
  await page.waitForTimeout(120);
  const stopped = await sprout.evaluate((element) => getComputedStyle(element).transform);
  // NOTE: Это проверка остановки во времени, а не ожидание готовности интерфейса.
  await page.waitForTimeout(300);
  expect(await sprout.evaluate((element) => getComputedStyle(element).transform)).toBe(stopped);
});

test('живые примеры на страницах 2–5 и смена темы закатом', async ({ page }) => {
  for (const [index, id] of [
    [1, 'demo-habits'],
    [2, 'demo-focus'],
    [3, 'demo-progress'],
    [4, 'demo-reminder'],
  ] as const) {
    await page.getByTestId('page-dot-' + index).click();
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.getByTestId('page-dot-0').click();
  await page.getByTestId('theme-button').click();
  await page.getByTestId('theme-option-dark').click();
  await page.getByTestId('sheet-close').click();
  // NOTE: Посреди смены темы солнце ещё видно, а к концу уходит за горизонт.
  await expect
    .poll(() =>
      page.getByTestId('world-sun').evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe('0');
  await expect
    .poll(() =>
      page.getByTestId('world-moon').evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe('1');
  await page.screenshot({ path: 'storage/reports/e2e/night-scene.png' });
});
