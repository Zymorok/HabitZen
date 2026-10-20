import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, signUp, uniqueEmail } from './helpers';

/** HZ-09: свой порядок привычек, архив с возвратом и частично набранный день в статистике. */

async function longPress(page: Page, testId: string, index = 0) {
  const box = await page.getByTestId(testId).nth(index).boundingBox();
  if (!box) throw new Error('Строка не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}

async function openMyHabits(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('settings-habits').click();
  await expect(page.getByTestId('my-habits-screen')).toBeVisible();
}

const titles = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluateAll((nodes) =>
    nodes
      .map((node) => ({ text: node.textContent ?? '', top: node.getBoundingClientRect().top }))
      .sort((left, right) => left.top - right.top)
      .map((entry) => entry.text),
  );

test('перетаскивание меняет порядок в списке и в плане дня', async ({ page }) => {
  await signUp(page, 'Порядок', uniqueEmail('order'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');
  await addHabit(page, 'Прогулка');
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('settings-habits-value')).toHaveText('3 привычки');
  await page.getByTestId('settings-habits').click();
  await expect(page.getByTestId('my-habits-screen')).toBeVisible();

  // NOTE: Берём «Прогулку» за ручку и тянем на самый верх.
  const handle = page.getByTestId('sortable-handle').nth(2);
  const box = await handle.boundingBox();
  if (!box) throw new Error('Ручка не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 70, { steps: 8 });
  await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await titles(page, 'my-habit')).map((text) => text.split(/Каждый/)[0]))
    .toEqual(['Прогулка', 'Вода', 'Чтение']);
  await page.screenshot({ path: 'storage/reports/e2e/hz09-my-habits.png' });

  // NOTE: Порядок сохранён на сервере — после перезагрузки и в плане дня он тот же.
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect
    .poll(async () => (await titles(page, 'my-habit')).map((text) => text.split(/Каждый/)[0]))
    .toEqual(['Прогулка', 'Вода', 'Чтение']);
  await page.goto('/today');
  await expect
    .poll(async () => (await titles(page, 'plan-row')).map((text) => text.trim()))
    .toEqual(['Прогулка', 'Вода', 'Чтение']);
});

test('архив и возврат привычки', async ({ page }) => {
  await signUp(page, 'Архив', uniqueEmail('restore'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');
  await longPress(page, 'plan-row', 1);
  await page.getByTestId('menu-archive').click();
  await expect(page.getByTestId('plan-row')).toHaveCount(1);

  await openMyHabits(page);
  await expect(page.getByTestId('archived-habit')).toContainText('Чтение');
  await page.screenshot({ path: 'storage/reports/e2e/hz09-archive.png' });
  await page.getByTestId('archive-restore').click();
  await expect(page.getByTestId('archived-habit')).toHaveCount(0);
  await expect(page.getByTestId('my-habit')).toHaveCount(2);

  await page.getByTestId('my-habits-back').click();
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('plan-row').filter({ hasText: 'Чтение' })).toBeVisible();
});

test('частично набранный день виден в статистике привычки', async ({ page }) => {
  await signUp(page, 'Доля', uniqueEmail('partial'));
  await page.getByTestId('today-create').click();
  await page.getByTestId('form-title').fill('Выпить воду');
  await page.getByTestId('form-goal-count').click();
  for (let step = 0; step < 5; step += 1) await page.getByTestId('form-goal-minus').click();
  await page.getByTestId('form-submit').click();
  const water = page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' });
  await water.getByTestId('plan-row-add').click();
  await expect(water.getByTestId('plan-row-details')).toHaveText('1 из 3 стаканов');
  await page.waitForLoadState('networkidle');

  await longPress(page, 'plan-row', 0);
  await page.getByTestId('menu-stats').click();
  await expect(page.getByTestId('habit-stats-screen')).toBeVisible();
  const today = page.getByTestId('habit-day').first();
  await expect(today).toContainText('1 из 3 стаканов');
  await expect(today.getByTestId('habit-day-partial')).toBeVisible();
  await page.screenshot({ path: 'storage/reports/e2e/hz09-partial-day.png' });
});
