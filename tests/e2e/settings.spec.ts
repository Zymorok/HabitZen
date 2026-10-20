import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

/** HZ-06: настройки (кадр 12) и напоминания на настоящем локальном Supabase. */

test('звуки, напоминания, тема и имя сохраняются', async ({ page }) => {
  await signUp(page, 'Настройки', uniqueEmail('settings'));
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('settings-title')).toHaveText('Настройки');
  await expect(page.getByTestId('settings-reminders-value')).toHaveText('Выкл.');
  await page.screenshot({ path: 'storage/reports/e2e/hz06-settings.png' });

  // NOTE: Выключенные звуки — фокус идёт в тишине.
  const sounds = page.getByRole('switch', { name: 'Звуки' });
  await expect(sounds).toBeChecked();
  await sounds.click();
  await expect(sounds).not.toBeChecked();
  await page.getByTestId('tab-focus').click();
  await expect(page.getByTestId('focus-sound')).toContainText('Без звука');

  await page.getByTestId('tab-profile').click();
  await page.getByTestId('settings-reminders').click();
  await expect(page.getByTestId('reminders-screen')).toBeVisible();
  await page.getByTestId('reminders-toggle').click();
  await expect(page.getByTestId('reminders-web-note')).toBeVisible();
  await page.getByTestId('reminders-time').click();
  await page.getByTestId('reminders-shift-60').click();
  await page.getByTestId('reminders-shift--15').click();
  await expect(page.getByTestId('reminders-time-value')).toHaveText('21:45');
  await page.getByTestId('reminders-back').click();
  await expect(page.getByTestId('settings-reminders-value')).toHaveText('21:45');

  await page.getByTestId('theme-dark').click();
  await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Тёмная тема' })).toBeChecked();

  await page.getByTestId('profile-card').click();
  await page.getByTestId('name-input').fill('Лера');
  await page.getByTestId('name-save').click();
  await expect(page.getByTestId('profile-name')).toHaveText('Лера');

  // NOTE: Звуки, напоминания и имя — в аккаунте, тема — на устройстве. Всё переживает перезагрузку.
  await page.reload();
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('profile-name')).toHaveText('Лера');
  await expect(page.getByTestId('settings-reminders-value')).toHaveText('21:45');
  await expect(page.getByRole('switch', { name: 'Звуки' })).not.toBeChecked();
  await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
});

test('напоминание у привычки включает общие напоминания', async ({ page }) => {
  await signUp(page, 'Напоминания', uniqueEmail('remind'));
  await page.getByTestId('today-create').click();
  await page.getByTestId('form-title').fill('Растяжка');
  await page.getByTestId('form-reminders').click();
  await expect(page.getByTestId('form-reminder-note')).toHaveText(
    'Напоминание придёт в приложении на телефоне.',
  );
  await page.getByTestId('form-submit').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('settings-reminders-value')).toHaveText('21:00');
  await page.getByTestId('settings-reminders').click();
  await expect(page.getByTestId('reminders-habit')).toContainText('Растяжка');
});
