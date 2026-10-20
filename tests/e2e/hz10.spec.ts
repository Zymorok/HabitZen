import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, completeHabit, signUp, uniqueEmail } from './helpers';

/** HZ-10: порядок на главном экране, «Быстрый старт», карточка дня и достижения. */

const rowTitles = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluateAll((nodes) =>
    nodes
      .map((node) => ({ text: node.textContent ?? '', top: node.getBoundingClientRect().top }))
      .sort((left, right) => left.top - right.top)
      .map((entry) => entry.text.trim()),
  );

test('порядок меняется перетаскиванием прямо на главном экране', async ({ page }) => {
  await signUp(page, 'Главная', uniqueEmail('today-order'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');
  await addHabit(page, 'Прогулка');

  await page.getByTestId('today-order').click();
  await expect(page.getByTestId('order-row')).toHaveCount(3);
  const handle = page.getByTestId('sortable-handle').nth(2);
  const box = await handle.boundingBox();
  if (!box) throw new Error('Ручка не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 8 });
  await page.mouse.move(box.x + box.width / 2, box.y - 140, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => rowTitles(page, 'order-row')).toEqual(['Прогулка', 'Вода', 'Чтение']);
  await page.screenshot({ path: 'storage/reports/e2e/hz10-today-order.png' });
  await page.getByTestId('today-order-done').click();

  await expect.poll(() => rowTitles(page, 'plan-row')).toEqual(['Прогулка', 'Вода', 'Чтение']);
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect.poll(() => rowTitles(page, 'plan-row')).toEqual(['Прогулка', 'Вода', 'Чтение']);
});

test('«Быстрый старт» заполняет форму, а значок подбирается по названию', async ({ page }) => {
  await signUp(page, 'Шаблон', uniqueEmail('template'));
  await page.getByTestId('today-create').click();
  await page.screenshot({ path: 'storage/reports/e2e/hz10-form-templates.png' });

  // NOTE: Значок сам меняется под название, пока человек не выбрал свой.
  await page.getByTestId('form-title').fill('Бег по утрам');
  await expect(page.getByTestId('form-icon-run')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('form-icon-music').click();
  await page.getByTestId('form-title').fill('Выпить воду');
  await expect(page.getByTestId('form-icon-music')).toHaveAttribute('aria-checked', 'true');

  await page.getByTestId('template-water').click();
  await expect(page.getByTestId('form-title')).toHaveValue('Выпить воду');
  await expect(page.getByTestId('form-icon-drop')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('form-goal-value')).toHaveText('8');
  await expect(page.getByTestId('form-tod-morning')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('form-submit').click();
  await expect(
    page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' }).getByTestId('plan-row-details'),
  ).toHaveText('0 из 8 стаканов');
});

test('карточка дня: кольцо, подсказка и лента недели', async ({ page }) => {
  await signUp(page, 'Кольцо', uniqueEmail('day-card'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');
  await expect(page.getByTestId('today-percent')).toHaveText('0%');
  await expect(page.getByTestId('today-motto')).toHaveText('Начни с самой лёгкой — дальше пойдёт');
  await expect(page.getByTestId('today-week').locator('[data-testid^="today-week-"]')).toHaveCount(
    7,
  );

  await completeHabit(page, 'Вода');
  await expect(page.getByTestId('today-percent')).toHaveText('50%');
  await expect(page.getByTestId('today-motto')).toHaveText('Осталась 1 привычка до полного дня');
  await page.screenshot({ path: 'storage/reports/e2e/hz10-day-card.png' });
});

test('первое выполнение даёт достижение с плашкой и значком на экране', async ({ page }) => {
  await signUp(page, 'Медаль', uniqueEmail('achievement'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');
  await completeHabit(page, 'Вода');

  const toast = page.getByTestId('achievement-toast');
  await expect(toast).toContainText('Первый шаг');
  await page.screenshot({ path: 'storage/reports/e2e/hz10-toast.png' });
  await toast.click();
  await expect(page.getByTestId('achievements-screen')).toBeVisible();
  await expect(page.getByTestId('achievements-count')).toHaveText('Открыто 1 из 10');
  await expect(page.getByTestId('achievement-first_step')).toContainText('Получено');
  await expect(page.getByTestId('achievement-streak_7')).toContainText('из 7');
  await page.screenshot({ path: 'storage/reports/e2e/hz10-achievements.png', fullPage: true });

  // NOTE: Плашка показывается один раз.
  await page.getByTestId('achievements-back').click();
  await page.reload();
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('achievement-toast')).toHaveCount(0);
});
