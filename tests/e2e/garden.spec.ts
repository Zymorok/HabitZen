import { expect, test } from '@playwright/test';
import { addHabit, completeHabit, runAsTestAccount, signUp, uniqueEmail } from './helpers';

/** HZ-06: дерево по уровням (кадр 10) и однократная награда за полный день (кадр 11). */

/** Прошлые выполнения тестового аккаунта: по одному на каждый из последних дней. */
function addPastCompletions(email: string, days: number) {
  runAsTestAccount(
    email,
    (owner) => `
      do $$
      declare
        uid uuid := ${owner};
        tz text := (select time_zone from public.profiles where id = uid);
        d integer;
        plan uuid;
      begin
        for d in 1..${days} loop
          insert into public.daily_plans(owner_id, local_date, time_zone)
            values (uid, (now() at time zone tz)::date - d, tz) returning id into plan;
          insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id,
              title_snapshot, icon_snapshot, color_snapshot, status, completed_at)
            select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key, 'completed', now()
            from public.habits h join public.habit_schedules s on s.habit_id = h.id
            where h.owner_id = uid;
        end loop;
      end $$;`,
  );
}

test('дерево растёт от выполнений, «Новый уровень!» показывается один раз', async ({ page }) => {
  const email = uniqueEmail('garden');
  await signUp(page, 'Сад', email);
  await addHabit(page, 'Вода');
  await page.getByTestId('today-tree').click();
  await expect(page.getByTestId('garden-level')).toHaveText('Уровень 1');
  await expect(page.getByTestId('garden-next')).toHaveText('До следующего уровня: 0 из 10');
  await expect(page.getByTestId('garden-level-up')).toHaveCount(0);
  await page.getByTestId('garden-back').click();

  // NOTE: Десять выполнений — ровно порог второго уровня.
  addPastCompletions(email, 10);
  await page.reload();
  await page.getByTestId('today-tree').click();
  await expect(page.getByTestId('garden-level')).toHaveText('Уровень 2');
  await expect(page.getByTestId('garden-level-up')).toBeVisible();
  await page.screenshot({ path: 'storage/reports/e2e/hz06-garden.png' });

  await page.getByTestId('garden-back').click();
  await page.getByTestId('today-tree').click();
  await expect(page.getByTestId('garden-level')).toHaveText('Уровень 2');
  await expect(page.getByTestId('garden-level-up')).toHaveCount(0);
});

test('полный день даёт награду один раз, отмена её не забирает', async ({ page }) => {
  await signUp(page, 'Награда', uniqueEmail('reward'));
  await addHabit(page, 'Вода');
  await addHabit(page, 'Чтение');

  await completeHabit(page, 'Вода');
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await completeHabit(page, 'Чтение');
  await expect(page.getByTestId('celebration-screen')).toBeVisible();
  await expect(page.getByTestId('celebration-title')).toHaveText('Все 2 привычки выполнены!');
  await expect(page.getByTestId('celebration-streak')).toContainText('1 день подряд');
  await page.screenshot({ path: 'storage/reports/e2e/hz06-celebration.png' });
  await page.getByTestId('celebration-ok').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();

  // NOTE: Отменил и снова отметил — второй награды за тот же день нет.
  await page.getByTestId('plan-row').filter({ hasText: 'Чтение' }).click();
  await page.getByTestId('hold-undo').click();
  await expect(page.getByTestId('hold-percent')).toContainText('0%');
  await page.getByTestId('hold-back').click();
  await completeHabit(page, 'Чтение');
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await expect(page.getByTestId('celebration-screen')).toHaveCount(0);

  await page.getByTestId('today-tree').click();
  await expect(page.getByTestId('garden-perfect-days')).toContainText('Полных дней: 1');
});
