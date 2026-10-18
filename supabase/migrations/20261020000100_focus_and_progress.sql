-- NOTE: HZ-05. Таймер фокуса 25/5 (кадры 06–07), календарь и история привычки (кадры 08–09).
-- Правила команд те же, что в HZ-03/04: проверенный пользователь, номер запроса, ожидаемая версия.
-- Время таймера считает сервер: в базе хранится срок окончания, а не тикающий остаток,
-- поэтому сворачивание и перезапуск приложения не сбивают таймер.
--   PT404 focus_not_found     — сессии нет или она чужая
--   PT404 habit_not_found     — привычки нет или она чужая
--   PT409 focus_active        — уже идёт другое занятие
--   PT409 focus_not_running   — пауза для неидущего таймера
--   PT409 focus_not_paused    — продолжение для таймера не на паузе
--   PT409 revision_conflict   — состояние изменилось на другом устройстве
--   PT422 invalid_phase       — неизвестная фаза
begin;

-- Сессия в том виде, в каком её ждёт приложение.
create function public.focus_json(s public.focus_sessions) returns jsonb
  language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', s.id, 'phase', s.phase, 'status', s.status, 'duration_ms', s.duration_ms,
    'remaining_ms', s.remaining_ms, 'deadline_at', s.deadline_at, 'revision', s.revision);
$$;

-- Идущая сессия со сроком в прошлом считается завершённой в момент срока. Приложение могло
-- быть закрыто, когда время вышло, — итог от этого не меняется.
create function public.focus_settle(p_owner uuid) returns void
  language sql security definer set search_path = '' as $$
  update public.focus_sessions
    set status = 'completed', finished_at = deadline_at, revision = revision + 1
    where owner_id = p_owner and status = 'running' and deadline_at <= statement_timestamp();
$$;

-- Состояние экрана «Фокус»: активная сессия или что предложить дальше, и сколько занятий сегодня.
create function public.current_focus() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  tz text;
  active public.focus_sessions%rowtype;
  has_active boolean;
  last public.focus_sessions%rowtype;
  next_phase text := 'focus';
  done_today integer;
  minutes_today integer;
begin
  perform public.focus_settle(uid);
  select p.time_zone into tz from public.profiles p where p.id = uid;
  select * into active from public.focus_sessions
    where owner_id = uid and status in ('running', 'paused');
  has_active := found;
  if has_active then
    next_phase := active.phase;
  else
    select * into last from public.focus_sessions
      where owner_id = uid order by started_at desc, finished_at desc limit 1;
    -- NOTE: Перерыв предлагается только сразу после полного занятия, а не через полдня.
    if found and last.phase = 'focus' and last.status = 'completed'
       and last.finished_at > statement_timestamp() - interval '1 hour' then
      next_phase := 'break';
    end if;
  end if;

  -- NOTE: Минуты — фактически отработанное время: паузы не считаются, досрочно завершённое
  -- занятие даёт свои минуты, но не засчитывается как полное.
  select (count(*) filter (where fs.status = 'completed'))::integer,
         (coalesce(sum(fs.duration_ms - coalesce(fs.remaining_ms, 0)), 0) / 60000)::integer
    into done_today, minutes_today
    from public.focus_sessions fs
    where fs.owner_id = uid and fs.phase = 'focus' and fs.status in ('completed', 'ended_early')
      and (fs.finished_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date;

  return pg_catalog.jsonb_build_object(
    'session', case when has_active then public.focus_json(active) else null end,
    'next_phase', next_phase,
    'completed_today', done_today,
    'minutes_today', minutes_today,
    -- NOTE: Часы телефона могут спешить: приложение сверяет срок со временем сервера.
    'server_now', statement_timestamp());
end;
$$;

create function public.start_focus(p_request_id uuid, p_phase text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  created public.focus_sessions%rowtype;
  duration integer;
begin
  if p_phase is null or p_phase not in ('focus', 'break') then
    raise exception 'invalid_phase' using errcode = 'PT422';
  end if;
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_phase)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'focus.start', digest);
  if previous is not null then
    return previous;
  end if;

  perform public.focus_settle(uid);
  duration := case p_phase when 'focus' then 1500000 else 300000 end;
  begin
    insert into public.focus_sessions(owner_id, phase, status, duration_ms, deadline_at, started_at)
      values (uid, p_phase, 'running', duration,
              statement_timestamp() + duration * interval '1 millisecond', statement_timestamp())
      returning * into created;
  exception when unique_violation then
    -- NOTE: Одна активная сессия на аккаунт: второе устройство не запустит параллельный таймер.
    raise exception 'focus_active' using errcode = 'PT409';
  end;
  return public.receipt_store(uid, p_request_id, 'focus.start', digest, public.focus_json(created));
end;
$$;

-- Пауза, продолжение, досрочное завершение и сброс — одна служебная функция с проверками.
create function public.change_focus(
  p_request_id uuid, p_session_id uuid, p_expected_revision integer, p_action text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  operation text := 'focus.' || p_action;
  current_row public.focus_sessions%rowtype;
  changed public.focus_sessions%rowtype;
  left_ms integer;
begin
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_session_id, p_expected_revision)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, operation, digest);
  if previous is not null then
    return previous;
  end if;

  select * into current_row from public.focus_sessions
    where id = p_session_id and owner_id = uid
    for update;
  if not found then
    raise exception 'focus_not_found' using errcode = 'PT404';
  end if;
  -- NOTE: Срок мог выйти, пока приложение было свёрнуто: сначала фиксируем это.
  if current_row.status = 'running' and current_row.deadline_at <= statement_timestamp() then
    perform public.focus_settle(uid);
    select * into current_row from public.focus_sessions where id = p_session_id;
  end if;
  -- NOTE: Завершить или сбросить уже закончившееся занятие — не ошибка: возвращаем его итог.
  if current_row.status not in ('running', 'paused') and p_action in ('finish', 'reset') then
    return public.focus_json(current_row);
  end if;
  if current_row.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  left_ms := case
    when current_row.status = 'running' then greatest(0, least(current_row.duration_ms,
      ceil(extract(epoch from (current_row.deadline_at - statement_timestamp())) * 1000)::integer))
    else current_row.remaining_ms
  end;

  if p_action = 'pause' then
    if current_row.status <> 'running' then
      raise exception 'focus_not_running' using errcode = 'PT409';
    end if;
    update public.focus_sessions
      set status = 'paused', remaining_ms = left_ms, deadline_at = null, revision = revision + 1
      where id = p_session_id returning * into changed;
  elsif p_action = 'resume' then
    if current_row.status <> 'paused' then
      raise exception 'focus_not_paused' using errcode = 'PT409';
    end if;
    update public.focus_sessions
      set status = 'running', remaining_ms = null,
          deadline_at = statement_timestamp() + current_row.remaining_ms * interval '1 millisecond',
          revision = revision + 1
      where id = p_session_id returning * into changed;
  elsif p_action in ('finish', 'reset') then
    -- NOTE: «Завершить раньше» сохраняет занятие как неполное; «Сброс» — как отменённое.
    -- Полным (completed) занятие становится только по сроку.
    update public.focus_sessions
      set status = case p_action when 'finish' then 'ended_early' else 'reset' end,
          remaining_ms = left_ms, deadline_at = null,
          finished_at = statement_timestamp(), revision = revision + 1
      where id = p_session_id returning * into changed;
  else
    raise exception 'invalid_action' using errcode = 'PT422';
  end if;

  return public.receipt_store(uid, p_request_id, operation, digest, public.focus_json(changed));
end;
$$;

create function public.pause_focus(p_request_id uuid, p_session_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.change_focus(p_request_id, p_session_id, p_expected_revision, 'pause');
$$;
create function public.resume_focus(p_request_id uuid, p_session_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.change_focus(p_request_id, p_session_id, p_expected_revision, 'resume');
$$;
create function public.finish_focus(p_request_id uuid, p_session_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.change_focus(p_request_id, p_session_id, p_expected_revision, 'finish');
$$;
create function public.reset_focus(p_request_id uuid, p_session_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.change_focus(p_request_id, p_session_id, p_expected_revision, 'reset');
$$;

-- «Пропустить» на кадре 07: перерыв записывается как пропущенный, следующим предлагается фокус.
create function public.skip_break(p_request_id uuid) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('[]', 'UTF8')), 'hex');
  previous jsonb;
  created public.focus_sessions%rowtype;
begin
  previous := public.receipt_lookup(uid, p_request_id, 'focus.skip_break', digest);
  if previous is not null then
    return previous;
  end if;
  perform public.focus_settle(uid);
  if exists (select 1 from public.focus_sessions
             where owner_id = uid and status in ('running', 'paused')) then
    raise exception 'focus_active' using errcode = 'PT409';
  end if;
  insert into public.focus_sessions(owner_id, phase, status, duration_ms, remaining_ms, started_at, finished_at)
    values (uid, 'break', 'reset', 300000, 300000, statement_timestamp(), statement_timestamp())
    returning * into created;
  return public.receipt_store(uid, p_request_id, 'focus.skip_break', digest, public.focus_json(created));
end;
$$;

-- Итоги дней за период для календаря (кадр 08) — запланировано, выполнено, «отдых».
-- Дни без открытого плана восстанавливаются по расписаниям того дня, как в серии HZ-04.
-- Период обрезается датой создания профиля и сегодняшним днём, не длиннее 366 дней.
create function public.calendar_days(p_from date, p_to date)
returns table (local_date date, planned integer, completed integer, skipped integer, outcome text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  tz text;
  today date;
  first_day date;
  last_day date;
begin
  select p.time_zone, (p.created_at at time zone p.time_zone)::date into tz, first_day
    from public.profiles p where p.id = uid;
  today := (statement_timestamp() at time zone tz)::date;
  last_day := least(coalesce(p_to, today), today);
  first_day := greatest(first_day, coalesce(p_from, last_day), last_day - 365);

  return query
  with days as (
    select g::date as day from pg_catalog.generate_series(first_day, last_day, interval '1 day') g
  ),
  opened as (
    select dp.local_date as day,
           count(i.id)::integer as planned,
           (count(i.id) filter (where i.status = 'completed'))::integer as completed,
           (count(i.id) filter (where i.status = 'skipped'))::integer as skipped
    from public.daily_plans dp
    join public.daily_plan_items i on i.plan_id = dp.id
    where dp.owner_id = uid and dp.local_date between first_day and last_day
    group by dp.local_date
  ),
  reconstructed as (
    select d.day, count(h.id)::integer as planned
    from days d
    join public.habits h on h.owner_id = uid
      and (h.created_at at time zone tz)::date <= d.day
      and (h.archived_at is null or (h.archived_at at time zone tz)::date > d.day)
    join lateral (
      select hs.weekday_mask from public.habit_schedules hs
      where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= d.day
      order by hs.effective_from desc limit 1
    ) s on true
    where (s.weekday_mask & (1 << (extract(isodow from d.day)::integer - 1))) <> 0
    group by d.day
  )
  select d.day,
         coalesce(o.planned, r.planned, 0),
         coalesce(o.completed, 0),
         coalesce(o.skipped, 0),
         case
           when coalesce(o.planned, r.planned, 0) = 0 then 'rest'
           when o.planned is not null and o.completed = o.planned then 'completed'
           else 'missed'
         end
  from days d
  left join opened o on o.day = d.day
  left join reconstructed r on r.day = d.day
  order by d.day;
end;
$$;

-- REFACTOR: Серия HZ-04 теперь берёт итоги дней из calendar_days — одно правило на оба экрана.
create or replace function public.day_outcomes(p_days integer default 120)
returns table (local_date date, planned integer, completed integer, outcome text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  today date := public.current_schedule_date(uid);
begin
  return query
    select c.local_date, c.planned, c.completed, c.outcome
    from public.calendar_days(today - least(greatest(coalesce(p_days, 120), 1), 365), today) c;
end;
$$;

-- История одной привычки (кадр 09): что было в каждый день.
--   completed — выполнено, skipped — «Сегодня отдых», missed — запланировано и не сделано,
--   pending — сегодня ещё можно сделать, rest — в этот день не запланирована.
create function public.habit_days(p_habit_id uuid, p_days integer default 30)
returns table (local_date date, status text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  tz text;
  today date;
  first_day date;
  habit public.habits%rowtype;
begin
  select * into habit from public.habits h where h.id = p_habit_id and h.owner_id = uid;
  if not found then
    raise exception 'habit_not_found' using errcode = 'PT404';
  end if;
  select p.time_zone into tz from public.profiles p where p.id = uid;
  today := (statement_timestamp() at time zone tz)::date;
  first_day := greatest((habit.created_at at time zone tz)::date,
                        today - (least(greatest(coalesce(p_days, 30), 1), 366) - 1));

  return query
  with days as (
    select g::date as day from pg_catalog.generate_series(first_day, today, interval '1 day') g
  )
  select d.day,
         case
           when i.status = 'completed' then 'completed'
           when i.status = 'skipped' then 'skipped'
           when i.status = 'pending' then case when d.day = today then 'pending' else 'missed' end
           -- NOTE: План того дня уже был зафиксирован без этой привычки — день для неё свободный.
           -- Исключение — привычка, созданная сегодня: open_today_plan добавит её при показе.
           when dp.id is not null
                and (d.day < today or (habit.created_at at time zone tz)::date < today) then 'rest'
           when (habit.archived_at is not null and (habit.archived_at at time zone tz)::date <= d.day)
             then 'rest'
           when s.weekday_mask is not null
                and (s.weekday_mask & (1 << (extract(isodow from d.day)::integer - 1))) <> 0
             then case when d.day = today then 'pending' else 'missed' end
           else 'rest'
         end
  from days d
  left join public.daily_plans dp on dp.owner_id = uid and dp.local_date = d.day
  left join public.daily_plan_items i on i.plan_id = dp.id and i.habit_id = habit.id
  left join lateral (
    select hs.weekday_mask from public.habit_schedules hs
    where hs.habit_id = habit.id and hs.owner_id = uid and hs.effective_from <= d.day
    order by hs.effective_from desc limit 1
  ) s on true
  order by d.day desc;
end;
$$;

revoke all on function public.focus_json(public.focus_sessions) from public, anon, authenticated;
revoke all on function public.focus_settle(uuid) from public, anon, authenticated;
revoke all on function public.change_focus(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.current_focus() from public, anon;
revoke all on function public.start_focus(uuid, text) from public, anon;
revoke all on function public.pause_focus(uuid, uuid, integer) from public, anon;
revoke all on function public.resume_focus(uuid, uuid, integer) from public, anon;
revoke all on function public.finish_focus(uuid, uuid, integer) from public, anon;
revoke all on function public.reset_focus(uuid, uuid, integer) from public, anon;
revoke all on function public.skip_break(uuid) from public, anon;
revoke all on function public.calendar_days(date, date) from public, anon;
revoke all on function public.habit_days(uuid, integer) from public, anon;
grant execute on function public.current_focus() to authenticated;
grant execute on function public.start_focus(uuid, text) to authenticated;
grant execute on function public.pause_focus(uuid, uuid, integer) to authenticated;
grant execute on function public.resume_focus(uuid, uuid, integer) to authenticated;
grant execute on function public.finish_focus(uuid, uuid, integer) to authenticated;
grant execute on function public.reset_focus(uuid, uuid, integer) to authenticated;
grant execute on function public.skip_break(uuid) to authenticated;
grant execute on function public.calendar_days(date, date) to authenticated;
grant execute on function public.habit_days(uuid, integer) to authenticated;
commit;
