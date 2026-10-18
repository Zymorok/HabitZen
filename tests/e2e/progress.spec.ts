import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, signUp, uniqueEmail } from './helpers';

/** HZ-05: календарь (кадр 08) и статистика привычки (кадр 09) на настоящем локальном Supabase. */
async function complete(page: Page, title: string) {
  await page.getByTestId('plan-row').filter({ hasText: title }).click();
  const box = await page.getByTestId('hold-target').boundingBox();
  if (!box) throw new Error('Кольцо удержания не найдено');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await page.getByTestId('done-continue').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}

test('календарь показывает сегодняшний итог, неделю и выполнения', async ({ page }) => {
  await signUp(page, 'Календарь', uniqueEmail('calendar'));
  await addHabit(page, 'Читать 20 минут');
  await addHabit(page, 'Выпить воду');
  await complete(page, 'Читать 20 минут');

  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('progress-screen')).toBeVisible();
  await expect(page.getByTestId('day-status')).toHaveText('1 из 2 выполнено');
  await expect(page.getByTestId('stat-completed')).toContainText('1');
  await expect(page.getByTestId('stat-week')).toContainText('50');
  await page.screenshot({ path: 'storage/reports/e2e/hz05-calendar.png' });

  // NOTE: Отметка на «Сегодня» сразу видна в календаре — кэш сбрасывается командой плана.
  await page.getByTestId('tab-today').click();
  await complete(page, 'Выпить воду');
  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('day-status')).toHaveText('2 из 2 выполнено');

  await page.getByTestId('month-prev').click();
  await expect(page.getByTestId('day-status')).toHaveText('Истории за этот день нет');
});

test('статистика привычки: серия, неделя, последние дни и изменение', async ({ page }) => {
  await signUp(page, 'Статистика', uniqueEmail('habit-stats'));
  await addHabit(page, 'Медитация');
  await complete(page, 'Медитация');

  await page.getByTestId('tab-progress').click();
  await page.getByTestId('progress-habit').filter({ hasText: 'Медитация' }).click();
  await expect(page.getByTestId('habit-stats-screen')).toBeVisible();
  await expect(page.getByTestId('habit-best-streak')).toContainText('1 день');
  await expect(page.getByTestId('habit-week-ratio')).toHaveText('1/1');
  await expect(page.getByTestId('habit-day').first()).toContainText('Выполнено');
  await page.screenshot({ path: 'storage/reports/e2e/hz05-habit.png' });

  await page.getByTestId('habit-tab-history').click();
  await expect(page.getByTestId('habit-history-total')).toContainText('1 из 1');

  await page.getByTestId('habit-stats-edit').click();
  await expect(page.getByTestId('habit-form')).toBeVisible();
  await expect(page.getByTestId('form-title')).toHaveValue('Медитация');
});
