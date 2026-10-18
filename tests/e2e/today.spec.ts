import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, signUp, uniqueEmail } from './helpers';

/** HZ-04: план на день (кадры 02–05) на настоящем локальном Supabase. */

async function holdFor(page: Page, ms: number) {
  const box = await page.getByTestId('hold-target').boundingBox();
  if (!box) throw new Error('Кольцо удержания не найдено');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function longPress(page: Page, testId: string, index = 0) {
  const box = await page.getByTestId(testId).nth(index).boundingBox();
  if (!box) throw new Error('Строка не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}

test('удержание 1,2 с отмечает привычку, короткое нажатие — нет', async ({ page }) => {
  await signUp(page, 'План', uniqueEmail('hold'));
  await addHabit(page, 'Выпить воду');
  await addHabit(page, 'Прогулка');
  await expect(page.getByTestId('today-progress')).toContainText('0 из 2');

  await page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' }).click();
  await expect(page.getByTestId('hold-screen')).toBeVisible();
  // NOTE: Отпустил раньше — кольцо откатывается, отметки нет.
  await holdFor(page, 350);
  await expect(page.getByTestId('hold-hint')).toContainText('Держи чуть дольше');
  await expect(page.getByTestId('done-screen')).toHaveCount(0);

  await holdFor(page, 1500);
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await expect(page.getByTestId('done-title')).toContainText('Отлично!');
  await expect(page.getByTestId('done-progress')).toContainText('1 из 2');
  await page.screenshot({ path: 'storage/reports/e2e/hz04-done.png' });

  await page.getByTestId('done-continue').click();
  await expect(page.getByTestId('today-progress')).toContainText('1 из 2');
  await page.screenshot({ path: 'storage/reports/e2e/hz04-today.png' });
  // NOTE: Повторное открытие выполненной привычки предлагает отмену, а не второе выполнение.
  await page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' }).click();
  await expect(page.getByTestId('hold-undo')).toBeVisible();
  await page.getByTestId('hold-undo').click();
  await expect(page.getByTestId('hold-percent')).toContainText('0%');
  await page.getByTestId('hold-back').click();
  await expect(page.getByTestId('today-progress')).toContainText('0 из 2');
});

test('«Сегодня отдых», изменение и архив через меню строки', async ({ page }) => {
  await signUp(page, 'Меню', uniqueEmail('menu'));
  await addHabit(page, 'Медитация');
  await addHabit(page, 'Английский');

  await longPress(page, 'plan-row', 0);
  await page.getByTestId('menu-skip').click();
  await expect(page.getByTestId('plan-row').first()).toContainText('Отдых');
  // NOTE: Отдых не превращается в долг: в прогрессе осталась одна привычка.
  await expect(page.getByTestId('today-progress')).toContainText('0 из 1');

  await longPress(page, 'plan-row', 1);
  await page.getByTestId('menu-edit').click();
  await expect(page.getByTestId('habit-form')).toBeVisible();
  await expect(page.getByTestId('form-title')).toHaveValue('Английский');
  await page.getByTestId('form-title').fill('Английский 15 минут');
  await page.getByTestId('form-submit').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
  // NOTE: Сегодняшний план сразу показывает новое название.
  await expect(page.getByTestId('plan-row').nth(1)).toContainText('Английский 15 минут');

  await longPress(page, 'plan-row', 1);
  await page.getByTestId('menu-archive').click();
  await expect(page.getByTestId('plan-row')).toHaveCount(1);
});
