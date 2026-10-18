import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, PASSWORD, signUp, uniqueEmail } from './helpers';

/**
 * HZ-03/04: аккаунт и данные на настоящем локальном Supabase.
 * NOTE: Нужен запущенный `npm run db:start` и приложение с apps/mobile/.env.local.
 * Каждый тест создаёт свои одноразовые аккаунты — общих паролей и демо-данных нет.
 */
const MAILPIT = process.env['HABITZEN_MAILPIT_URL'] ?? 'http://127.0.0.1:55324';

async function signOut(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('onboarding-shell')).toBeVisible();
}

test('регистрация, привычка в базе, выход и повторный вход', async ({ page }) => {
  const email = uniqueEmail('main');
  await signUp(page, 'Валерия', email);
  await expect(page.getByTestId('today-empty')).toBeVisible();
  await addHabit(page, 'Читать 20 минут');
  await expect(page.getByTestId('today-progress')).toContainText('0 из 1');

  // NOTE: Сессия и привычка переживают перезагрузку страницы.
  await page.reload();
  await expect(page.getByTestId('plan-row')).toContainText('Читать 20 минут');
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('profile-name')).toContainText('Валерия');

  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('onboarding-shell')).toBeVisible();
  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(PASSWORD);
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('plan-row')).toContainText('Читать 20 минут');
});

test('второй аккаунт не видит чужих привычек', async ({ browser }) => {
  const first = await browser.newPage();
  await signUp(first, 'Первый', uniqueEmail('a'));
  await addHabit(first, 'Личная привычка');

  const second = await browser.newPage();
  await signUp(second, 'Второй', uniqueEmail('b'));
  await expect(second.getByTestId('today-empty')).toBeVisible();
  await expect(second.getByTestId('plan-row')).toHaveCount(0);
  await first.close();
  await second.close();
});

test('неверный пароль и занятая почта дают понятные сообщения', async ({ page }) => {
  const email = uniqueEmail('err');
  await signUp(page, 'Ошибки', email);
  await signOut(page);

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
  await signOut(page);
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
  await expect(page.getByTestId('today-screen')).toBeVisible();

  await signOut(page);
  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill('New-habit-pass-1');
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
});
