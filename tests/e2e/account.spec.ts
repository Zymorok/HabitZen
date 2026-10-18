import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * HZ-03: аккаунт и привычки на настоящем локальном Supabase.
 * NOTE: Нужен запущенный `npm run db:start` и приложение с apps/mobile/.env.local.
 * Каждый тест создаёт свои одноразовые аккаунты — общих паролей и демо-данных нет.
 */
const MAILPIT = process.env['HABITZEN_MAILPIT_URL'] ?? 'http://127.0.0.1:55324';
const PASSWORD = 'Habit-zen-2026';

function uniqueEmail(tag: string): string {
  return `hz-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('sign-up-screen')).toBeVisible();
  await page.getByTestId('sign-up-name').fill(name);
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('habits-screen')).toBeVisible();
}

test('регистрация, привычка в базе, выход и повторный вход', async ({ page }) => {
  const email = uniqueEmail('main');
  await signUp(page, 'Валерия', email);
  await expect(page.getByTestId('habits-hello')).toContainText('Валерия');
  await expect(page.getByTestId('habits-empty')).toBeVisible();

  await page.getByTestId('new-habit-title').fill('Читать 20 минут');
  await page.getByTestId('category-reading').click();
  await page.getByTestId('weekday-6').click();
  await page.getByTestId('new-habit-submit').click();
  await expect(page.getByTestId('new-habit-saved')).toBeVisible();
  const row = page.getByTestId('habit-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Читать 20 минут');
  await expect(row).toContainText('Пн, Вт, Ср, Чт, Пт, Сб');

  // NOTE: Сессия и привычка переживают перезагрузку страницы.
  await page.reload();
  await expect(page.getByTestId('habit-row')).toContainText('Читать 20 минут');
  await page.screenshot({ path: 'storage/reports/e2e/habits-signed-in.png' });

  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('onboarding-shell')).toBeVisible();
  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(PASSWORD);
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('habit-row')).toContainText('Читать 20 минут');

  await page.getByTestId('habit-archive').click();
  await expect(page.getByTestId('habits-empty')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('habits-empty')).toBeVisible();
});

test('второй аккаунт не видит чужих привычек', async ({ browser }) => {
  const first = await browser.newPage();
  await signUp(first, 'Первый', uniqueEmail('a'));
  await first.getByTestId('new-habit-title').fill('Личная привычка');
  await first.getByTestId('new-habit-submit').click();
  await expect(first.getByTestId('habit-row')).toContainText('Личная привычка');

  const second = await browser.newPage();
  await signUp(second, 'Второй', uniqueEmail('b'));
  await expect(second.getByTestId('habits-empty')).toBeVisible();
  await expect(second.getByTestId('habit-row')).toHaveCount(0);
  await first.close();
  await second.close();
});

test('неверный пароль и занятая почта дают понятные сообщения', async ({ page }) => {
  const email = uniqueEmail('err');
  await signUp(page, 'Ошибки', email);
  await page.getByTestId('sign-out').click();

  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill('wrong-password-1');
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('sign-in-error')).toContainText('Неверная почта или пароль');

  await page.getByTestId('go-sign-up').click();
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('sign-up-error')).toContainText('уже есть');

  await page.getByTestId('sign-up-password').fill('short');
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('sign-up-password-error')).toBeVisible();
});

test('восстановление пароля по ссылке из письма', async ({ page, request }) => {
  const email = uniqueEmail('reset');
  await signUp(page, 'Восстановление', email);
  await page.getByTestId('sign-out').click();
  await page.getByTestId('account-button').click();
  await page.getByTestId('go-forgot').click();
  await page.getByTestId('forgot-email').fill(email);
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByTestId('forgot-sent')).toBeVisible();

  // NOTE: Локальный Supabase складывает письма в Mailpit; берём ссылку из письма этого адреса.
  let link = '';
  await expect
    .poll(async () => {
      const list = await (
        await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)
      ).json();
      const id = list.messages?.[0]?.ID;
      if (!id) return '';
      const message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
      const match = /https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/.exec(
        message.Text ?? message.HTML ?? '',
      );
      link = match ? match[0].replace(/&amp;/g, '&') : '';
      return link;
    })
    .not.toBe('');

  await page.goto(link);
  await expect(page.getByTestId('new-password-screen')).toBeVisible();
  await page.getByTestId('new-password').fill('New-habit-pass-1');
  await page.getByTestId('new-password-submit').click();
  await expect(page.getByTestId('habits-screen')).toBeVisible();

  await page.getByTestId('sign-out').click();
  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill('New-habit-pass-1');
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('habits-screen')).toBeVisible();
});
