-- NOTE: HZ-08. Цель с количеством, «+1», графики «N раз в неделю» и «каждые N дней»,
-- фокус для привычки и итоги недели.
begin;
insert into auth.users values
  ('16000000-0000-0000-0000-000000000001'),
  ('16000000-0000-0000-0000-000000000002');
update public.profiles set created_at = statement_timestamp() - interval '10 days'
  where id = '16000000-0000-0000-0000-000000000001';

-- NOTE: Правило «положена ли привычка в этот день» — без пользователя, на фиксированных датах.
do $$ begin
  if not public.schedule_due('interval', 127::smallint, 2::smallint, '2026-10-01', '2026-10-03') then
    raise exception 'FAIL: «каждые 2 дня» не попал на третий день';
  end if;
  if public.schedule_due('interval', 127::smallint, 2::smallint, '2026-10-01', '2026-10-02') then
    raise exception 'FAIL: «каждые 2 дня» попал на следующий день';
  end if;
  if public.schedule_due('interval', 127::smallint, 2::smallint, '2026-10-01', '2026-09-29') then
    raise exception 'FAIL: «каждые 2 дня» действует до начала';
  end if;
  -- 2026-10-19 — понедельник (бит 0), 2026-10-20 — вторник.
  if not public.schedule_due('days', 1::smallint, null, '2026-10-01', '2026-10-19')
     or public.schedule_due('days', 1::smallint, null, '2026-10-01', '2026-10-20') then
    raise exception 'FAIL: дни недели посчитаны неверно';
  end if;
  if public.schedule_due('weekly', 127::smallint, null, '2026-10-01', '2026-10-19') then
    raise exception 'FAIL: «N раз в неделю» привязан к дню';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
do $$
declare
  item record;
  result jsonb;
  repeated jsonb;
begin
  perform public.create_habit('ffff0000-0000-0000-0000-000000000001', 'Выпить воду', 'water', 'drop', 'blue',
    127::smallint, '{}', 8, 'glasses', 'morning');
  select * into item from public.open_today_plan() where title = 'Выпить воду';
  if item.target <> 8 or item.progress <> 0 or item.goal_unit <> 'glasses' or item.time_of_day <> 'morning' then
    raise exception 'FAIL: цель или время дня не попали в план';
  end if;

  result := public.add_plan_progress('ffff1111-0000-0000-0000-000000000001', item.item_id, item.revision, 1);
  repeated := public.add_plan_progress('ffff1111-0000-0000-0000-000000000001', item.item_id, item.revision, 1);
  if result <> repeated or (result ->> 'progress')::integer <> 1 or result ->> 'status' <> 'pending' then
    raise exception 'FAIL: +1 посчитан неверно или удвоен повтором';
  end if;
  result := public.add_plan_progress('ffff1111-0000-0000-0000-000000000002', item.item_id, item.revision + 1, 7);
  if result ->> 'status' <> 'completed' then raise exception 'FAIL: цель 8 из 8 не выполнила привычку'; end if;
  if (select completed_at from public.open_today_plan() where item_id = item.item_id) is null then
    raise exception 'FAIL: нет времени выполнения';
  end if;
  result := public.add_plan_progress('ffff1111-0000-0000-0000-000000000003', item.item_id, item.revision + 2, -1);
  if result ->> 'status' <> 'pending' or (result ->> 'progress')::integer <> 7 then
    raise exception 'FAIL: −1 не вернул отметку в работу';
  end if;
  result := public.add_plan_progress('ffff1111-0000-0000-0000-000000000004', item.item_id, item.revision + 3, 1000);
  if (result ->> 'progress')::integer <> 80 then raise exception 'FAIL: перевыполнение не ограничено'; end if;
  begin
    perform public.add_plan_progress('ffff1111-0000-0000-0000-000000000005', item.item_id, item.revision + 4, 0);
    raise exception 'FAIL: принят нулевой шаг';
  exception when sqlstate 'PT422' then null; end;

  -- NOTE: Отмена обнуляет прогресс, удержание выполняет цель целиком.
  perform public.undo_plan_item('ffff1111-0000-0000-0000-000000000006', item.item_id, item.revision + 4);
  if (select progress from public.open_today_plan() where item_id = item.item_id) <> 0 then
    raise exception 'FAIL: отмена не обнулила прогресс';
  end if;
  perform public.complete_plan_item('ffff1111-0000-0000-0000-000000000007', item.item_id, item.revision + 5);
  if (select progress from public.open_today_plan() where item_id = item.item_id) <> 8 then
    raise exception 'FAIL: удержание не выполнило цель целиком';
  end if;

  -- NOTE: Цель уменьшили — сегодняшняя отметка пересчитана.
  perform public.undo_plan_item('ffff1111-0000-0000-0000-000000000008', item.item_id, item.revision + 6);
  perform public.add_plan_progress('ffff1111-0000-0000-0000-000000000009', item.item_id, item.revision + 7, 6);
  perform public.update_habit('ffff1111-0000-0000-0000-000000000010', item.habit_id, 1, 'Выпить воду', 'water',
    'drop', 'blue', 127::smallint, '{}', 5, 'glasses', 'morning');
  if (select status from public.open_today_plan() where item_id = item.item_id) <> 'completed' then
    raise exception 'FAIL: новая цель не применилась к сегодняшней отметке';
  end if;

  begin
    perform public.create_habit('ffff0000-0000-0000-0000-000000000002', 'Ноль', 'custom', 'heart', 'rose',
      127::smallint, '{}', 0);
    raise exception 'FAIL: принята нулевая цель';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.create_habit('ffff0000-0000-0000-0000-000000000003', 'Без нормы', 'custom', 'heart', 'rose',
      127::smallint, '{}', 1, 'times', 'any', 'weekly');
    raise exception 'FAIL: «N раз в неделю» без числа';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.create_habit('ffff0000-0000-0000-0000-000000000004', 'Ночью', 'custom', 'heart', 'rose',
      127::smallint, '{}', 1, 'times', 'night');
    raise exception 'FAIL: неизвестное время дня';
  exception when sqlstate 'PT422' then null; end;

  -- NOTE: «2 раза в неделю» — гибкая строка: невыполненная не делает день пропущенным.
  perform public.create_habit('ffff0000-0000-0000-0000-000000000005', 'Бассейн', 'fitness', 'walk', 'mint',
    127::smallint, '{}', 1, 'times', 'evening', 'weekly', 2::smallint);
  perform public.create_habit('ffff0000-0000-0000-0000-000000000006', 'Через день', 'custom', 'sun', 'sand',
    127::smallint, '{}', 1, 'times', 'any', 'interval', null, 2::smallint);
  select * into item from public.open_today_plan() where title = 'Бассейн';
  if not item.flexible or item.per_week <> 2 or item.week_done <> 0 then
    raise exception 'FAIL: недельная привычка не стала гибкой строкой';
  end if;
  if (select count(*) from public.open_today_plan() where title = 'Через день') <> 1 then
    raise exception 'FAIL: «каждые 2 дня» не попала в план в первый день';
  end if;
  select * into item from public.open_today_plan() where title = 'Через день';
  perform public.complete_plan_item('ffff1111-0000-0000-0000-000000000011', item.item_id, item.revision);
  if (select outcome from public.calendar_days(current_date, current_date)) <> 'completed' then
    raise exception 'FAIL: невыполненная недельная привычка помешала полному дню';
  end if;
  perform pg_catalog.set_config('test.reward',
    (public.claim_day_reward('ffff1111-0000-0000-0000-000000000012') ->> 'granted'), true);
  if current_setting('test.reward') <> 'true' then
    raise exception 'FAIL: награда ждёт недельную привычку';
  end if;
  select * into item from public.open_today_plan() where title = 'Бассейн';
  perform public.complete_plan_item('ffff1111-0000-0000-0000-000000000013', item.item_id, item.revision);
  if (select week_done from public.open_today_plan() where title = 'Бассейн') <> 1 then
    raise exception 'FAIL: недельный счёт не вырос';
  end if;
end $$;

-- NOTE: Недельная норма на фиксированной неделе: пн и вт выполнено — к среде норма 2 закрыта.
reset role;
do $$
declare
  uid uuid := '16000000-0000-0000-0000-000000000001';
  habit uuid := (select id from public.habits where title = 'Бассейн');
  schedule uuid := (select id from public.habit_schedules where habit_id = (select id from public.habits where title = 'Бассейн'));
  plan uuid;
  d date;
begin
  foreach d in array array['2026-09-14'::date, '2026-09-15'::date] loop
    insert into public.daily_plans(owner_id, local_date, time_zone) values (uid, d, 'UTC') returning id into plan;
    insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id, title_snapshot, icon_snapshot,
        color_snapshot, status, completed_at, progress, flexible)
      values (uid, plan, habit, schedule, 'Бассейн', 'walk', 'mint', 'completed', now(), 1, true);
  end loop;
  if public.week_completions(uid, habit, '2026-09-16', false) <> 2 then
    raise exception 'FAIL: недельный счёт посчитан неверно';
  end if;
  if public.week_completions(uid, habit, '2026-09-14', false) <> 0 then
    raise exception 'FAIL: прошлая неделя попала в счёт';
  end if;
end $$;

-- NOTE: Вчерашняя невыполненная недельная привычка в истории — свободный день, не пропуск.
do $$
declare
  uid uuid := '16000000-0000-0000-0000-000000000001';
  habit uuid := (select id from public.habits where title = 'Бассейн');
  schedule uuid := (select id from public.habit_schedules where habit_id = (select id from public.habits where title = 'Бассейн'));
  plan uuid;
  yesterday date := (statement_timestamp() at time zone 'UTC')::date - 1;
begin
  update public.habits set created_at = now() - interval '3 days' where id = habit;
  update public.habit_schedules set effective_from = yesterday - 2 where id = schedule;
  insert into public.daily_plans(owner_id, local_date, time_zone) values (uid, yesterday, 'UTC')
    on conflict (owner_id, local_date) do update set time_zone = excluded.time_zone
    returning id into plan;
  insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id, title_snapshot, icon_snapshot,
      color_snapshot, status, flexible)
    values (uid, plan, habit, schedule, 'Бассейн', 'walk', 'mint', 'pending', true)
    on conflict (plan_id, habit_id) do update set status = 'pending', completed_at = null, progress = 0;
  perform pg_catalog.set_config('test.habit', habit::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
do $$
declare
  yesterday date := (statement_timestamp() at time zone 'UTC')::date - 1;
  water uuid := (select id from public.habits where title = 'Выпить воду');
  reading uuid;
  session jsonb;
  summary jsonb;
begin
  if (select status from public.habit_days(current_setting('test.habit')::uuid, 30) where local_date = yesterday) <> 'rest' then
    raise exception 'FAIL: невыполненная недельная привычка стала пропуском';
  end if;
  if (select progress from public.habit_days(water, 30) where local_date = (statement_timestamp() at time zone 'UTC')::date) <> 6 then
    raise exception 'FAIL: история не показывает прогресс цели';
  end if;

  -- NOTE: Фокус для привычки «Читать 30 минут»: досрочно 10 минут, затем полное занятие.
  perform public.create_habit('ffff0000-0000-0000-0000-000000000007', 'Читать', 'reading', 'book', 'apricot',
    127::smallint, '{}', 30, 'minutes');
  reading := (select id from public.habits where title = 'Читать');
  perform public.open_today_plan();
  session := public.start_focus('ffff2222-0000-0000-0000-000000000001', 'focus', reading);
  if (session ->> 'habit_id')::uuid <> reading then raise exception 'FAIL: сессия не знает привычку'; end if;
  perform pg_catalog.set_config('test.session', session ->> 'id', true);
end $$;

reset role;
update public.focus_sessions set deadline_at = statement_timestamp() + interval '15 minutes'
  where id = current_setting('test.session')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
do $$
declare
  session uuid := current_setting('test.session')::uuid;
  reading uuid := (select id from public.habits where title = 'Читать');
  started jsonb;
begin
  perform public.finish_focus('ffff2222-0000-0000-0000-000000000002', session, 1);
  if (select progress from public.open_today_plan() where habit_id = reading) <> 10 then
    raise exception 'FAIL: досрочное занятие не засчитало 10 минут';
  end if;
  started := public.start_focus('ffff2222-0000-0000-0000-000000000003', 'focus', reading);
  perform pg_catalog.set_config('test.session2', started ->> 'id', true);
  begin
    perform public.start_focus('ffff2222-0000-0000-0000-000000000004', 'focus',
      '00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL: фокус для несуществующей привычки';
  exception when sqlstate 'PT409' or sqlstate 'PT404' then null; end;
end $$;

reset role;
update public.focus_sessions set deadline_at = statement_timestamp() - interval '1 second'
  where id = current_setting('test.session2')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
do $$
declare
  reading uuid := (select id from public.habits where title = 'Читать');
  summary jsonb;
  today date := (statement_timestamp() at time zone 'UTC')::date;
begin
  perform public.current_focus();
  if (select status from public.open_today_plan() where habit_id = reading) <> 'completed'
     or (select progress from public.open_today_plan() where habit_id = reading) <> 35 then
    raise exception 'FAIL: полное занятие не засчитано в привычку';
  end if;

  summary := public.week_summary(today);
  if (summary ->> 'focus_minutes')::integer <> 35 then
    raise exception 'FAIL: итоги недели не посчитали минуты фокуса: %', summary ->> 'focus_minutes';
  end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(summary -> 'habits') h
    where h ->> 'title' = 'Читать' and (h ->> 'completed')::integer = 1 and (h ->> 'progress')::integer = 35
  ) then
    raise exception 'FAIL: итоги недели без привычки «Читать»';
  end if;
  if (select goal_target from public.list_active_habits() where title = 'Выпить воду') <> 5
     or (select frequency from public.list_active_habits() where title = 'Бассейн') <> 'weekly' then
    raise exception 'FAIL: список привычек без цели и графика';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);
do $$
begin
  begin
    -- NOTE: Чужую привычку второй аккаунт не видит (RLS), поэтому id берём из настройки теста.
    perform public.start_focus('ffff3333-0000-0000-0000-000000000001', 'focus',
      current_setting('test.habit')::uuid);
    raise exception 'FAIL: фокус для чужой привычки';
  exception when sqlstate 'PT404' then null; end;
  if jsonb_array_length(public.week_summary(current_date) -> 'habits') <> 0 then
    raise exception 'FAIL: в итогах чужие привычки';
  end if;
end $$;
reset role;
rollback;
