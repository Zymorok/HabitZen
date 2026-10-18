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
