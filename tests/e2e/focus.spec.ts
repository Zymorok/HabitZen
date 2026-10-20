import { expect, test } from '@playwright/test';
import { runAsTestAccount, signUp, uniqueEmail } from './helpers';

/** HZ-05: таймер фокуса 25/5 (кадры 06–07) на настоящем локальном Supabase. */

/** Сдвигает срок идущего занятия тестового аккаунта, чтобы не ждать 25 минут. */
function finishSoon(email: string) {
  runAsTestAccount(
    email,
    (owner) => `update public.focus_sessions set deadline_at = now() + interval '2 seconds'
                where status = 'running' and owner_id = ${owner};`,
  );
}

test('пауза сохраняет остаток после перезагрузки, сброс возвращает 25:00', async ({ page }) => {
  await signUp(page, 'Фокус', uniqueEmail('focus'));
  await page.getByTestId('tab-focus').click();
  await expect(page.getByTestId('focus-time')).toHaveText('25:00');
  await expect(page.getByTestId('focus-reset')).toHaveAttribute('aria-disabled', 'true');

  await page.getByTestId('focus-main').click();
  await expect(page.getByTestId('focus-time')).not.toHaveText('25:00', { timeout: 4000 });
  await page.getByTestId('focus-main').click();
  await expect(page.getByTestId('focus-caption')).toHaveText('На паузе');
  const paused = await page.getByTestId('focus-time').innerText();
  await page.waitForTimeout(2200);
  await expect(page.getByTestId('focus-time')).toHaveText(paused);

  // NOTE: Остаток хранится на сервере: перезагрузка не сбрасывает и не двигает таймер.
  await page.reload();
  await expect(page.getByTestId('focus-caption')).toHaveText('На паузе');
  await expect(page.getByTestId('focus-time')).toHaveText(paused);

  await page.getByTestId('focus-reset').click();
  await expect(page.getByTestId('focus-time')).toHaveText('25:00');
  await expect(page.getByTestId('focus-caption')).toContainText('25 мин');
});

test('по окончании фокуса предлагается перерыв с дыханием, «Пропустить» возвращает фокус', async ({
  page,
}) => {
  const email = uniqueEmail('break');
  await signUp(page, 'Перерыв', email);
  await page.getByTestId('tab-focus').click();
  await page.getByTestId('focus-main').click();
  await expect(page.getByTestId('focus-time')).not.toHaveText('25:00', { timeout: 4000 });

  finishSoon(email);
  await page.reload();
  await expect(page.getByTestId('focus-title')).toHaveText('Пора отдохнуть', { timeout: 15000 });
  await expect(page.getByTestId('focus-time')).toHaveText('05:00');
  await expect(page.getByTestId('focus-caption')).toHaveText(/Вдох|Выдох/);
  await page.screenshot({ path: 'storage/reports/e2e/hz05-break.png' });

  await page.getByTestId('focus-main').click();
  await expect(page.getByTestId('focus-time')).not.toHaveText('05:00', { timeout: 4000 });
  await page.getByTestId('focus-skip').click();
  await expect(page.getByTestId('focus-title')).toHaveText('Фокус');
  await expect(page.getByTestId('focus-time')).toHaveText('25:00');
  // NOTE: Полное занятие засчитано: первая точка под кнопкой заполнена.
  await expect(page.getByTestId('focus-dots')).toHaveAttribute(
    'aria-label',
    'Сегодня завершено 1 занятие',
  );
});

test('выбранный звук сохраняется в аккаунте', async ({ page }) => {
  await signUp(page, 'Звук', uniqueEmail('sound'));
  await page.getByTestId('tab-focus').click();
  await expect(page.getByTestId('focus-sound')).toContainText('Без звука');
  await page.getByTestId('focus-sound').click();
  await page.getByTestId('menu-sound-forest').click();
  await expect(page.getByTestId('focus-sound')).toContainText('Лес');
  await page.reload();
  await expect(page.getByTestId('focus-sound')).toContainText('Лес');
});
