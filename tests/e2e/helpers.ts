import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Общие шаги сценариев аккаунта и плана дня. Не тест-файл: Playwright его не запускает. */
export const PASSWORD = 'Habit-zen-2026';

export function uniqueEmail(tag: string): string {
  return `hz-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export async function signUp(page: Page, name: string, email: string) {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('sign-up-screen')).toBeVisible();
  await page.getByTestId('sign-up-name').fill(name);
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}

export async function addHabit(page: Page, title: string) {
  // NOTE: Сначала ждём загрузки плана: пустой план показывает свою кнопку, непустой — «+».
  const empty = page.getByTestId('today-create');
  const add = page.getByTestId('today-add');
  await expect(empty.or(add)).toBeVisible();
  if (await empty.isVisible()) await empty.click();
  else await add.click();
  await expect(page.getByTestId('habit-form')).toBeVisible();
  await page.getByTestId('form-title').fill(title);
  await page.getByTestId('form-submit').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await expect(page.getByTestId('plan-row').filter({ hasText: title })).toBeVisible();
}

const DB_CONTAINER = process.env['HABITZEN_DB_CONTAINER'] ?? 'supabase_db_habitzen-local';

/**
 * SQL в локальной базе разработки от имени одноразового тестового аккаунта: сдвинуть срок
 * таймера или добавить прошлые выполнения, чтобы не ждать 25 минут или десять дней.
 * NOTE: Подставляется только адрес вида hz-…@example.com — чужие данные недоступны.
 */
export function runAsTestAccount(email: string, statement: (owner: string) => string) {
  if (!/^hz-[a-z0-9-]+@example\.com$/.test(email)) throw new Error('Только тестовые адреса');
  const owner = `(select id from auth.users where email = '${email}')`;
  execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'],
    { input: statement(owner), encoding: 'utf8' },
  );
}

/** Удержание 1,2 с на привычке и «Продолжить» на экране «Отлично!». */
export async function completeHabit(page: Page, title: string) {
  await page.getByTestId('plan-row').filter({ hasText: title }).click();
  const box = await page.getByTestId('hold-target').boundingBox();
  if (!box) throw new Error('Кольцо удержания не найдено');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await page.getByTestId('done-continue').click();
}
