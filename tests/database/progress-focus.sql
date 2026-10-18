-- NOTE: HZ-05. Таймер фокуса (пауза, продолжение, срок, перерыв, сброс), календарь и история привычки.
begin;
insert into auth.users values
  ('13000000-0000-0000-0000-000000000001'),
  ('13000000-0000-0000-0000-000000000002');
update public.profiles
  set created_at = statement_timestamp() - interval '7 days'
  where id = '13000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
do $$
declare
  state jsonb;
  started jsonb;
  repeated jsonb;
  paused jsonb;
  session uuid;
begin
  state := public.current_focus();
  if state -> 'session' <> 'null'::jsonb or state ->> 'next_phase' <> 'focus'
     or (state ->> 'completed_today')::integer <> 0 then
    raise exception 'FAIL: у нового аккаунта не пустой таймер';
  end if;

  started := public.start_focus('aaaa0000-0000-0000-0000-000000000001', 'focus');
  repeated := public.start_focus('aaaa0000-0000-0000-0000-000000000001', 'focus');
  if started <> repeated then raise exception 'FAIL: повтор запуска дал другой результат'; end if;
  if (select count(*) from public.focus_sessions) <> 1 then
    raise exception 'FAIL: повтор запуска создал вторую сессию';
  end if;
  if started ->> 'status' <> 'running' or (started ->> 'duration_ms')::integer <> 1500000 then
    raise exception 'FAIL: фокус запущен не на 25 минут';
  end if;
  session := (started ->> 'id')::uuid;
  perform pg_catalog.set_config('test.session', session::text, true);

  begin
    perform public.start_focus('aaaa0000-0000-0000-0000-000000000002', 'focus');
    raise exception 'FAIL: запущен второй таймер параллельно';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.start_focus('aaaa0000-0000-0000-0000-000000000003', 'nap');
    raise exception 'FAIL: принята неизвестная фаза';
  exception when sqlstate 'PT422' then null; end;

  paused := public.pause_focus('aaaa0000-0000-0000-0000-000000000004', session, 1);
  if paused ->> 'status' <> 'paused' or (paused ->> 'remaining_ms')::integer not between 1490000 and 1500000
     or (paused ->> 'revision')::integer <> 2 then
    raise exception 'FAIL: пауза не сохранила остаток';
  end if;
  begin
    perform public.pause_focus('aaaa0000-0000-0000-0000-000000000005', session, 2);
    raise exception 'FAIL: пауза на паузе';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.resume_focus('aaaa0000-0000-0000-0000-000000000006', session, 1);
    raise exception 'FAIL: продолжение по устаревшей версии';
  exception when sqlstate 'PT409' then null; end;
  if public.resume_focus('aaaa0000-0000-0000-0000-000000000007', session, 2) ->> 'status' <> 'running' then
    raise exception 'FAIL: таймер не продолжился';
  end if;

  begin
    perform public.change_focus('aaaa0000-0000-0000-0000-000000000008', session, 3, 'reset');
    raise exception 'FAIL: клиент вызывает служебную функцию таймера';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.focus_sessions(owner_id, phase, status, duration_ms, deadline_at)
      values ('13000000-0000-0000-0000-000000000001', 'focus', 'running', 1500000, now());
    raise exception 'FAIL: клиент пишет таймер напрямую';
  exception when insufficient_privilege then null; end;
end $$;

-- NOTE: Срок вышел, пока приложение было закрыто: занятие засчитывается, предлагается перерыв.
reset role;
update public.focus_sessions set deadline_at = statement_timestamp() - interval '2 seconds'
  where id = current_setting('test.session')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
do $$
declare
  session uuid := current_setting('test.session')::uuid;
  state jsonb;
  finished jsonb;
  break_session jsonb;
begin
  state := public.current_focus();
  if state -> 'session' <> 'null'::jsonb or state ->> 'next_phase' <> 'break' then
    raise exception 'FAIL: после полного занятия не предложен перерыв';
  end if;
  if (state ->> 'completed_today')::integer <> 1 then
    raise exception 'FAIL: завершённое занятие не посчитано за сегодня';
  end if;
  if (state ->> 'minutes_today')::integer <> 25 then
    raise exception 'FAIL: минуты фокуса посчитаны вместе с паузой';
  end if;
  if (select finished_at = deadline_at from public.focus_sessions where id = session) is not true then
    raise exception 'FAIL: время окончания не совпало со сроком';
  end if;
  -- NOTE: «Завершить» уже закончившееся занятие возвращает его итог без ошибки.
  finished := public.finish_focus('aaaa0000-0000-0000-0000-000000000009', session, 3);
  if finished ->> 'status' <> 'completed' then
    raise exception 'FAIL: досрочное завершение испортило полное занятие';
  end if;

  perform public.skip_break('aaaa0000-0000-0000-0000-000000000010');
  if public.current_focus() ->> 'next_phase' <> 'focus' then
    raise exception 'FAIL: после пропуска перерыва не предложен фокус';
  end if;

  break_session := public.start_focus('aaaa0000-0000-0000-0000-000000000011', 'break');
  if (break_session ->> 'duration_ms')::integer <> 300000 then
    raise exception 'FAIL: перерыв не 5 минут';
  end if;
  begin
    perform public.skip_break('aaaa0000-0000-0000-0000-000000000012');
    raise exception 'FAIL: пропуск перерыва поверх идущего таймера';
  exception when sqlstate 'PT409' then null; end;
  if public.finish_focus('aaaa0000-0000-0000-0000-000000000013', (break_session ->> 'id')::uuid, 1)
       ->> 'status' <> 'ended_early' then
    raise exception 'FAIL: перерыв не завершился досрочно';
  end if;

  session := (public.start_focus('aaaa0000-0000-0000-0000-000000000014', 'focus') ->> 'id')::uuid;
  if public.reset_focus('aaaa0000-0000-0000-0000-000000000015', session, 1) ->> 'status' <> 'reset' then
    raise exception 'FAIL: сброс не сохранён';
  end if;
  state := public.current_focus();
  if state -> 'session' <> 'null'::jsonb or (state ->> 'completed_today')::integer <> 1 then
    raise exception 'FAIL: сброшенное или неполное занятие посчитано как полное';
  end if;
end $$;

-- NOTE: Календарь и история привычки.
do $$
declare
  today date := (statement_timestamp() at time zone 'UTC')::date;
  item record;
begin
  perform public.create_habit('aaaa1111-0000-0000-0000-000000000001', 'Читать 20 минут', 'reading', 'book', 'sage', 127::smallint);
  perform public.create_habit('aaaa1111-0000-0000-0000-000000000002', 'Вода', 'water', 'drop', 'blue', 127::smallint);
  perform public.create_habit('aaaa1111-0000-0000-0000-000000000003', 'Прогулка', 'fitness', 'walk', 'apricot', 127::smallint);
  select * into item from public.open_today_plan() where title = 'Читать 20 минут';
  perform public.complete_plan_item('aaaa2222-0000-0000-0000-000000000001', item.item_id, item.revision);
  select * into item from public.open_today_plan() where title = 'Вода';
  perform public.skip_plan_item('aaaa2222-0000-0000-0000-000000000002', item.item_id, item.revision);

  if (select count(*) from public.calendar_days(today - 3, today)) <> 4 then
    raise exception 'FAIL: календарь вернул не те дни';
  end if;
  if (select count(*) from public.calendar_days(today - 400, today + 30)) <> 8 then
    raise exception 'FAIL: календарь не обрезан датой профиля и сегодняшним днём';
  end if;
  if (select count(*) from public.calendar_days(today, today - 1)) <> 0 then
    raise exception 'FAIL: перевёрнутый период вернул дни';
  end if;
  if (select (planned, completed, skipped) from public.calendar_days(today, today))
     is distinct from (3, 1, 1) then
    raise exception 'FAIL: итог сегодняшнего дня в календаре неверен';
  end if;
  if exists (
    select 1 from public.calendar_days(today - 30, today) c
    join public.day_outcomes(30) d using (local_date)
    where c.outcome <> d.outcome or c.planned <> d.planned
  ) then
    raise exception 'FAIL: серия и календарь считают дни по-разному';
  end if;
end $$;

-- NOTE: «Читать» существовало четыре дня: вчера и позавчера без отметок — пропуски.
reset role;
update public.habits set created_at = statement_timestamp() - interval '4 days'
  where owner_id = '13000000-0000-0000-0000-000000000001' and title = 'Читать 20 минут';
update public.habit_schedules set effective_from = (statement_timestamp() at time zone 'UTC')::date - 4
  where habit_id = (select id from public.habits where title = 'Читать 20 минут');
set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
do $$
declare
  today date := (statement_timestamp() at time zone 'UTC')::date;
  reading uuid := (select id from public.habits where title = 'Читать 20 минут');
  water uuid := (select id from public.habits where title = 'Вода');
  walk uuid := (select id from public.habits where title = 'Прогулка');
begin
  perform pg_catalog.set_config('test.habit', reading::text, true);
  if (select count(*) from public.habit_days(reading, 30)) <> 5 then
    raise exception 'FAIL: история привычки начинается не с даты создания';
  end if;
  if (select status from public.habit_days(reading, 30) where local_date = today) <> 'completed' then
    raise exception 'FAIL: сегодняшнее выполнение не попало в историю';
  end if;
  if (select status from public.habit_days(reading, 30) where local_date = today - 1) <> 'missed' then
    raise exception 'FAIL: вчерашний пропуск не попал в историю';
  end if;
  if (select local_date from public.habit_days(reading, 30) limit 1) <> today then
    raise exception 'FAIL: история не начинается с сегодняшнего дня';
  end if;
  if (select count(*) from public.habit_days(reading, 2)) <> 2 then
    raise exception 'FAIL: история не ограничена запрошенным числом дней';
  end if;
  if (select status from public.habit_days(water, 30) where local_date = today) <> 'skipped' then
    raise exception 'FAIL: «Сегодня отдых» не попал в историю';
  end if;
  if (select status from public.habit_days(walk, 30) where local_date = today) <> 'pending' then
    raise exception 'FAIL: невыполненная сегодняшняя привычка не ждёт отметки';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
do $$
begin
  if public.current_focus() -> 'session' <> 'null'::jsonb then
    raise exception 'FAIL: виден чужой таймер';
  end if;
  begin
    perform public.reset_focus('bbbb0000-0000-0000-0000-000000000001', current_setting('test.session')::uuid, 3);
    raise exception 'FAIL: сброшен чужой таймер';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.habit_days(current_setting('test.habit')::uuid, 30);
    raise exception 'FAIL: видна чужая история привычки';
  exception when sqlstate 'PT404' then null; end;
  if (select count(*) from public.calendar_days(current_date - 30, current_date) where planned > 0) <> 0 then
    raise exception 'FAIL: в календаре чужие привычки';
  end if;
end $$;
reset role;
rollback;
