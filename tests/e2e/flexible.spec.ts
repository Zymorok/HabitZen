import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addHabit, completeHabit, runAsTestAccount, signUp, uniqueEmail } from './helpers';

/** HZ-08: цель с количеством, «N раз в неделю», интервал и разделы «Утро / День / Вечер». */

async function openForm(page: Page) {
  const empty = page.getByTestId('today-create');
  const add = page.getByTestId('today-add');
  await expect(empty.or(add)).toBeVisible();
  if (await empty.isVisible()) await empty.click();
  else await add.click();
  await expect(page.getByTestId('habit-form')).toBeVisible();
}

async function longPress(page: Page, testId: string, index = 0) {
  const box = await page.getByTestId(testId).nth(index).boundingBox();
  if (!box) throw new Error('Строка не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}

test('«+1» набирает цель по стакану, а набранная цель ведёт на кадр 05', async ({ page }) => {
  await signUp(page, 'Вода', uniqueEmail('goal'));
  await addHabit(page, 'Прогулка');

  await openForm(page);
  await page.getByTestId('form-title').fill('Выпить воду');
  await page.getByTestId('form-goal-count').click();
  await expect(page.getByTestId('form-goal-value')).toHaveText('8');
  for (let step = 0; step < 5; step += 1) await page.getByTestId('form-goal-minus').click();
  await expect(page.getByTestId('form-goal-value')).toHaveText('3');
  await page.getByTestId('form-tod-morning').click();
  await page.screenshot({ path: 'storage/reports/e2e/hz08-form-goal.png' });
  await page.getByTestId('form-submit').click();

  // NOTE: Утренняя привычка делит план на разделы: «Утро» и «В любое время».
  await expect(page.getByTestId('plan-section-morning')).toContainText('Утро');
  await expect(page.getByTestId('plan-section-any')).toContainText('В любое время');
  const water = page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' });
  await expect(water.getByTestId('plan-row-details')).toHaveText('0 из 3 стаканов');

  // NOTE: Два быстрых нажатия не теряются и не спорят о версии.
  await water.getByTestId('plan-row-add').click();
  await water.getByTestId('plan-row-add').click();
  await expect(water.getByTestId('plan-row-details')).toHaveText('2 из 3 стаканов');
  await expect(page.getByTestId('today-progress')).toContainText('0 из 2');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'storage/reports/e2e/hz08-plan-sections.png' });
  await page.reload();
  await expect(
    page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' }).getByTestId('plan-row-details'),
  ).toHaveText('2 из 3 стаканов');

  await page.getByTestId('plan-row').filter({ hasText: 'Выпить воду' }).click();
  await expect(page.getByTestId('hold-title')).toHaveText('2 из 3 стаканов');
  await expect(page.getByTestId('hold-percent')).toHaveText('67%');
  await expect(page.getByTestId('hold-amount-value')).toHaveText('2');
  await page.screenshot({ path: 'storage/reports/e2e/hz08-hold-amount.png' });
  await page.getByTestId('hold-amount-plus').click();
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await page.getByTestId('done-continue').click();
  await expect(page.getByTestId('today-progress')).toContainText('1 из 2');
});

test('«3 раза в неделю» — по желанию: день без неё не считается долгом', async ({ page }) => {
  await signUp(page, 'Неделя', uniqueEmail('weekly'));

  await openForm(page);
  await page.getByTestId('form-title').fill('Бассейн');
  await page.getByTestId('form-freq-weekly').click();
  await expect(page.getByTestId('form-per-week-value')).toHaveText('3');
  await expect(page.getByTestId('form-day-0')).toHaveCount(0);
  await page.getByTestId('form-submit').click();
  await addHabit(page, 'Читать');

  const pool = page.getByTestId('plan-row').filter({ hasText: 'Бассейн' });
  await expect(pool.getByTestId('plan-row-details')).toHaveText('0 из 3 на этой неделе');
  // NOTE: В счёт дня идёт только обязательное чтение.
  await expect(page.getByTestId('today-progress')).toContainText('0 из 1');

  await completeHabit(page, 'Бассейн');
  await expect(page.getByTestId('today-progress')).toContainText('1 из 2');
  await expect(pool.getByTestId('plan-row-details')).toHaveText('1 из 3 на этой неделе');
});

test('«каждый 3-й день» сохраняется и открывается в форме изменения', async ({ page }) => {
  await signUp(page, 'Интервал', uniqueEmail('interval'));
  await openForm(page);
  await page.getByTestId('form-title').fill('Полить цветы');
  await page.getByTestId('form-freq-interval').click();
  await page.getByTestId('form-interval-plus').click();
  await expect(page.getByTestId('form-interval-value')).toHaveText('3');
  await page.getByTestId('form-tod-evening').click();
  await page.getByTestId('form-submit').click();

  // NOTE: Отсчёт начинается сегодня — значит, сегодня привычка в плане.
  await expect(page.getByTestId('plan-section-evening')).toContainText('Вечер');
  await longPress(page, 'plan-row', 0);
  await page.getByTestId('menu-edit').click();
  await expect(page.getByTestId('form-freq-interval')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('form-interval-value')).toHaveText('3');
  await expect(page.getByTestId('form-tod-evening')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('form-goal-check')).toHaveAttribute('aria-checked', 'true');
});

test('фокус для привычки засчитывает 25 минут в цель «20 минут»', async ({ page }) => {
  const email = uniqueEmail('focus-habit');
  await signUp(page, 'Чтение', email);
  await addHabit(page, 'Прогулка');
  await openForm(page);
  await page.getByTestId('form-title').fill('Читать');
  await page.getByTestId('form-goal-count').click();
  await page.getByTestId('form-unit-minutes').click();
  await expect(page.getByTestId('form-goal-value')).toHaveText('20');
  await page.getByTestId('form-submit').click();

  const reading = page.getByTestId('plan-row').filter({ hasText: 'Читать' });
  await expect(reading.getByTestId('plan-row-details')).toHaveText('0 из 20 минут');
  await longPress(page, 'plan-row', 1);
  await page.getByTestId('menu-focus').click();
  await expect(page.getByTestId('focus-screen')).toBeVisible();
  await expect(page.getByTestId('focus-habit')).toContainText('Читать');
  await page.screenshot({ path: 'storage/reports/e2e/hz08-focus-habit.png' });
  await page.getByTestId('focus-main').click();
  await expect(page.getByTestId('focus-caption')).toContainText('Фокус');

  // NOTE: Сдвигаем срок занятия, чтобы не ждать 25 минут.
  runAsTestAccount(
    email,
    (owner) => `update public.focus_sessions set deadline_at = now() + interval '2 seconds'
                where status = 'running' and owner_id = ${owner};`,
  );
  await page.reload();
  await expect(page.getByTestId('focus-title')).toHaveText('Пора отдохнуть', { timeout: 15000 });

  await page.getByTestId('tab-today').click();
  await expect(reading.getByTestId('plan-row-details')).toHaveText('25 из 20 минут');
  await expect(page.getByTestId('today-progress')).toContainText('1 из 2');
});

test('заморозка серии закрывает вчерашний пропуск', async ({ page }) => {
  const email = uniqueEmail('freeze');
  await signUp(page, 'Лёд', email);
  await addHabit(page, 'Читать');
  // NOTE: 15 выполненных дней дают две заморозки, вчерашний пропуск тратит одну.
  runAsTestAccount(
    email,
    (owner) => `
      do $$
      declare
        uid uuid := ${owner};
        tz text := (select time_zone from public.profiles where id = uid);
        today date := (now() at time zone tz)::date;
        d integer;
        plan uuid;
      begin
        update public.profiles set created_at = now() - interval '16 days' where id = uid;
        update public.habits set created_at = created_at - interval '16 days' where owner_id = uid;
        update public.habit_schedules set effective_from = today - 16 where owner_id = uid;
        for d in 1..16 loop
          insert into public.daily_plans(owner_id, local_date, time_zone)
            values (uid, today - d, tz) returning id into plan;
          insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id,
              title_snapshot, icon_snapshot, color_snapshot, status, completed_at)
            select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key,
                   case when d = 1 then 'pending' else 'completed' end,
                   case when d = 1 then null else now() - d * interval '1 day' end
            from public.habits h join public.habit_schedules s on s.habit_id = h.id
            where h.owner_id = uid;
        end loop;
      end $$;`,
  );
  await page.reload();
  await expect(page.getByTestId('today-streak')).toContainText('15 дней подряд');
  await expect(page.getByTestId('today-freezes')).toHaveText('1');
  await page.screenshot({ path: 'storage/reports/e2e/hz08-freeze-today.png' });

  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('freeze-stock')).toHaveText('Заморозок в запасе: 1 из 2');
  const yesterday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  // NOTE: Вчера может оказаться в прошлом месяце — тогда листаем назад.
  if ((await page.getByTestId(`day-${yesterday}`).count()) === 0)
    await page.getByTestId('month-prev').click();
  await expect(page.getByTestId(`day-${yesterday}`)).toHaveAttribute(
    'aria-label',
    /Серию сохранила заморозка/,
  );
  await page.getByTestId('freeze-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'storage/reports/e2e/hz08-freeze-calendar.png' });
});

test('итоги недели и годовая карта показывают сегодняшнюю отметку', async ({ page }) => {
  await signUp(page, 'Итоги', uniqueEmail('week'));
  await addHabit(page, 'Читать');
  await completeHabit(page, 'Читать');
  await page.getByTestId('celebration-ok').click();

  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('year-active')).toHaveText('Активных дней: 1');
  await page.getByTestId('year-map').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'storage/reports/e2e/hz08-year-map.png' });
  await page.getByTestId('open-week').click();
  await expect(page.getByTestId('week-summary-screen')).toBeVisible();
  await expect(page.getByTestId('week-percent')).toHaveText('100%');
  await expect(page.getByTestId('week-delta')).toContainText('Первая неделя');
  await expect(page.getByTestId('week-habit-ratio')).toHaveText('1/1');
  await expect(page.getByTestId('week-completed')).toContainText('1');
  await page.screenshot({ path: 'storage/reports/e2e/hz08-week-summary.png', fullPage: true });

  // NOTE: Неделей раньше привычки ещё не было.
  await page.getByTestId('week-prev').click();
  await expect(page.getByTestId('week-empty')).toBeVisible();
  await page.getByTestId('week-next').click();
  await expect(page.getByTestId('week-percent')).toHaveText('100%');
});

test('цветовая тема перекрашивает приложение и сохраняется', async ({ page }) => {
  await signUp(page, 'Тема', uniqueEmail('accent'));
  await addHabit(page, 'Читать');
  const fab = page.getByTestId('today-add');
  const color = () => fab.evaluate((node) => getComputedStyle(node.parentElement!).backgroundColor);
  expect(await color()).toBe('rgb(45, 98, 73)');

  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('accent-forest')).toHaveAttribute('aria-checked', 'true');
  for (const accent of ['sunset', 'ocean', 'lavender'] as const) {
    await page.getByTestId(`accent-${accent}`).click();
    await expect(page.getByTestId(`accent-${accent}`)).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('tab-today').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `storage/reports/e2e/hz08-accent-${accent}.png` });
    await page.getByTestId('tab-profile').click();
  }
  await page.getByTestId('accent-ocean').click();
  await page.screenshot({ path: 'storage/reports/e2e/hz08-accent-settings.png', fullPage: true });

  // NOTE: Тема хранится на устройстве и переживает перезагрузку.
  await page.reload();
  await page.getByTestId('tab-today').click();
  expect(await color()).toBe('rgb(36, 94, 120)');
});
