// NOTE: HZ-07. Демо-аккаунт для снимков и видео: регистрация через интерфейс, пять привычек
// как на макете и три недели истории в локальной базе разработки. Только адреса
// hz-…@example.com — чужие данные не трогаются.
import { execFileSync } from 'node:child_process';

const container = process.env['HABITZEN_DB_CONTAINER'] ?? 'supabase_db_habitzen-local';
export const PASSWORD = 'Habit-zen-2026';
export const HABITS = [
  ['Выпить воду', 'drop', 'blue'],
  ['Читать 20 минут', 'book', 'apricot'],
  ['Прогулка', 'walk', 'sand'],
  ['Английский', 'system', 'blue'],
  ['Медитация', 'leaf', 'rose'],
];

export function demoEmail(tag) {
  return `hz-${tag}-${Date.now()}@example.com`;
}

export function sql(statement) {
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'],
    { input: statement, encoding: 'utf8' },
  );
}

function ownerOf(email) {
  if (!/^hz-[a-z0-9-]+@example\.com$/.test(email)) throw new Error('Только демо-адреса');
  return `(select id from auth.users where email = '${email}')`;
}

/** Три недели истории: последние семь дней полные, раньше — примерно 70 %; сегодня 3 из 5. */
export function seedHistory(email) {
  sql(`
    do $$
    declare
      uid uuid := ${ownerOf(email)};
      tz text := (select time_zone from public.profiles where id = uid);
      today date := (now() at time zone tz)::date;
      d integer;
      plan uuid;
    begin
      update public.profiles set created_at = now() - interval '24 days' where id = uid;
      -- Сдвиг на 24 дня сохраняет порядок привычек в плане, как на кадре 02.
      update public.habits set created_at = created_at - interval '24 days' where owner_id = uid;
      update public.habit_schedules set effective_from = today - 24 where owner_id = uid;
      for d in 1..22 loop
        insert into public.daily_plans(owner_id, local_date, time_zone)
          values (uid, today - d, tz) returning id into plan;
        insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id,
            title_snapshot, icon_snapshot, color_snapshot, status, completed_at)
          select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key,
                 case when d <= 7 or (d * 7 + length(h.title)) % 10 < 7 then 'completed' else 'pending' end,
                 case when d <= 7 or (d * 7 + length(h.title)) % 10 < 7 then now() - d * interval '1 day' end
          from public.habits h join public.habit_schedules s on s.habit_id = h.id
          where h.owner_id = uid;
      end loop;
      update public.daily_plan_items i
        set status = 'completed', completed_at = now(), revision = revision + 1
        from public.daily_plans dp
        where dp.id = i.plan_id and dp.owner_id = uid and dp.local_date = today
          and i.title_snapshot in ('Выпить воду', 'Читать 20 минут', 'Прогулка');
    end $$;`);
}

/** Срок идущего занятия — через секунду, чтобы показать перерыв без ожидания 25 минут. */
export function finishFocusSoon(email) {
  sql(`update public.focus_sessions set deadline_at = now() + interval '1 second'
       where status = 'running' and owner_id = ${ownerOf(email)};`);
}

/** Регистрация и пять привычек через интерфейс; onForm — снимок формы второй привычки. */
export async function createDemoAccount(page, baseURL, email, onForm) {
  await page.goto(baseURL);
  await page.getByTestId('start-button').click();
  await page.getByTestId('sign-up-name').fill('Валерия');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill(PASSWORD);
  await page.getByTestId('sign-up-submit').click();
  await page.getByTestId('today-screen').waitFor();
  for (const [index, [title, icon, color]] of HABITS.entries()) {
    await page.getByTestId(index === 0 ? 'today-create' : 'today-add').click();
    await page.getByTestId('habit-form').waitFor();
    await page.getByTestId('form-title').fill(title);
    await page.getByTestId(`form-icon-${icon}`).click();
    await page.getByTestId(`form-color-${color}`).click();
    if (index === 1 && onForm) {
      await page.getByTestId('form-reminders').click();
      await onForm();
    }
    await page.getByTestId('form-submit').click();
    await page.getByTestId('plan-row').filter({ hasText: title }).waitFor();
  }
  seedHistory(email);
  await page.reload();
  await page.getByTestId('today-screen').waitFor();
}

export async function holdAt(page, ms) {
  const box = await page.getByTestId('hold-target').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
}
