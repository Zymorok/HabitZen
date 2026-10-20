-- NOTE: HZ-08. Гибкие привычки:
--   цель с количеством (8 стаканов, 20 минут, 10 страниц) и прогресс «+1» в плане дня;
--   график по дням недели, «N раз в неделю» или «каждые N дней»;
--   время дня (утро, день, вечер) для разделов плана;
--   занятие фокуса для привычки — минуты засчитываются в неё;
--   итоги недели.
-- Правила команд прежние: проверенный пользователь, номер запроса, ожидаемая версия.
--   PT422 invalid_goal / invalid_time_of_day / invalid_amount — неверные значения
begin;

alter table public.habits
  add column goal_target integer not null default 1 check (goal_target between 1 and 100000),
  add column goal_unit text not null default 'times'
    check (goal_unit in ('times', 'glasses', 'minutes', 'pages', 'steps', 'km')),
  add column time_of_day text not null default 'any'
    check (time_of_day in ('any', 'morning', 'afternoon', 'evening'));

alter table public.habit_schedules
  add column frequency text not null default 'days'
    check (frequency in ('days', 'weekly', 'interval')),
  add column per_week smallint check (per_week between 1 and 6),
  add column interval_days smallint check (interval_days between 2 and 14),
  add constraint habit_schedules_frequency_shape check (
    (frequency = 'days' and per_week is null and interval_days is null)
    or (frequency = 'weekly' and per_week is not null and interval_days is null)
    or (frequency = 'interval' and interval_days is not null and per_week is null));

-- NOTE: Цель фиксируется в строке плана, как название: изменение цели не переписывает прошлое.
-- «Гибкая» строка — привычка «N раз в неделю»: её невыполнение в отдельный день не считается пропуском.
alter table public.daily_plan_items
  add column target integer not null default 1 check (target >= 1),
  add column progress integer not null default 0 check (progress >= 0),
  add column flexible boolean not null default false;
update public.daily_plan_items set progress = target where status = 'completed';

alter table public.focus_sessions
  add column habit_id uuid,
  add constraint focus_sessions_habit_fk foreign key (habit_id, owner_id)
    references public.habits(id, owner_id);

-- Положена ли привычка в этот день по своей версии расписания. Одна функция для плана,
-- календаря и истории — правила не расходятся. «N раз в неделю» не привязано к дню.
create function public.schedule_due(
  p_frequency text, p_mask smallint, p_interval smallint, p_from date, p_day date
) returns boolean language sql immutable set search_path = '' as $$
  select case p_frequency
    when 'days' then (p_mask & (1 << (extract(isodow from p_day)::integer - 1))) <> 0
    when 'interval' then p_day >= p_from and (p_day - p_from) % p_interval = 0
    else false
  end;
$$;

drop function public.validate_habit_input(text, text, text, text, smallint, time[]);
create function public.validate_habit_input(
  p_title text, p_category text, p_icon_key text, p_color_key text,
  p_weekday_mask smallint, p_reminder_times time[],
  p_goal_target integer, p_goal_unit text, p_time_of_day text,
  p_frequency text, p_per_week smallint, p_interval_days smallint
) returns text language plpgsql immutable set search_path = '' as $$
declare
  clean_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(clean_title) not between 1 and 120 then
    raise exception 'invalid_title' using errcode = 'PT422';
  end if;
  if p_category is null or p_category not in ('water', 'reading', 'fitness', 'meditation', 'learning', 'custom') then
    raise exception 'invalid_category' using errcode = 'PT422';
  end if;
  if p_icon_key is null or char_length(p_icon_key) not between 1 and 40 then
    raise exception 'invalid_icon' using errcode = 'PT422';
  end if;
  if p_color_key is null or p_color_key not in ('sage', 'mint', 'apricot', 'sand', 'blue', 'rose') then
    raise exception 'invalid_color' using errcode = 'PT422';
  end if;
  if p_goal_target is null or p_goal_target not between 1 and 100000
     or p_goal_unit is null or p_goal_unit not in ('times', 'glasses', 'minutes', 'pages', 'steps', 'km') then
    raise exception 'invalid_goal' using errcode = 'PT422';
  end if;
  if p_time_of_day is null or p_time_of_day not in ('any', 'morning', 'afternoon', 'evening') then
    raise exception 'invalid_time_of_day' using errcode = 'PT422';
  end if;
  -- WARNING: Сравнение с NULL даёт NULL, а не false, поэтому каждое условие обёрнуто в coalesce:
  -- иначе «N раз в неделю» без числа прошло бы проверку.
  if not coalesce(
    (p_frequency = 'days' and coalesce(p_weekday_mask between 1 and 127, false))
    or (p_frequency = 'weekly' and coalesce(p_per_week between 1 and 6, false))
    or (p_frequency = 'interval' and coalesce(p_interval_days between 2 and 14, false)),
    false
  ) then
    raise exception 'invalid_schedule' using errcode = 'PT422';
  end if;
  if pg_catalog.cardinality(coalesce(p_reminder_times, '{}')) > 4 then
    raise exception 'invalid_reminders' using errcode = 'PT422';
  end if;
  return clean_title;
end;
$$;

drop function public.create_habit(uuid, text, text, text, text, smallint, time[]);
create function public.create_habit(
  p_request_id uuid,
  p_title text,
  p_category text,
  p_icon_key text,
  p_color_key text,
  p_weekday_mask smallint,
  p_reminder_times time[] default '{}',
  p_goal_target integer default 1,
  p_goal_unit text default 'times',
  p_time_of_day text default 'any',
  p_frequency text default 'days',
  p_per_week smallint default null,
  p_interval_days smallint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  clean_title text;
  digest text;
  previous jsonb;
  new_habit uuid;
  tz text;
  mask smallint := case when p_frequency = 'days' then p_weekday_mask else 127 end;
begin
  clean_title := public.validate_habit_input(
    p_title, p_category, p_icon_key, p_color_key, mask, p_reminder_times,
    p_goal_target, p_goal_unit, p_time_of_day, p_frequency, p_per_week, p_interval_days);
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    clean_title, p_category, p_icon_key, p_color_key, mask, coalesce(p_reminder_times, '{}'),
    p_goal_target, p_goal_unit, p_time_of_day, p_frequency, p_per_week, p_interval_days
  )::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.create', digest);
  if previous is not null then
    return previous;
  end if;

  select time_zone into tz from public.profiles where id = uid;
  insert into public.habits(owner_id, title, category, icon_key, color_key, goal_target, goal_unit, time_of_day)
    values (uid, clean_title, p_category, p_icon_key, p_color_key, p_goal_target, p_goal_unit, p_time_of_day)
    returning id into new_habit;
  insert into public.habit_schedules(owner_id, habit_id, effective_from, weekday_mask, time_zone,
      reminder_times, frequency, per_week, interval_days)
    values (uid, new_habit, public.current_schedule_date(uid), mask, tz, coalesce(p_reminder_times, '{}'),
      p_frequency,
      case when p_frequency = 'weekly' then p_per_week end,
      case when p_frequency = 'interval' then p_interval_days end);

  return public.receipt_store(uid, p_request_id, 'habit.create', digest,
    pg_catalog.jsonb_build_object('habit_id', new_habit, 'revision', 1));
end;
$$;

drop function public.update_habit(uuid, uuid, integer, text, text, text, text, smallint, time[]);
create function public.update_habit(
  p_request_id uuid,
  p_habit_id uuid,
  p_expected_revision integer,
  p_title text,
  p_category text,
  p_icon_key text,
  p_color_key text,
  p_weekday_mask smallint,
  p_reminder_times time[] default '{}',
  p_goal_target integer default 1,
  p_goal_unit text default 'times',
  p_time_of_day text default 'any',
  p_frequency text default 'days',
  p_per_week smallint default null,
  p_interval_days smallint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  clean_title text;
  digest text;
  previous jsonb;
  existing public.habits%rowtype;
  today date;
  tz text;
  mask smallint := case when p_frequency = 'days' then p_weekday_mask else 127 end;
begin
  clean_title := public.validate_habit_input(
    p_title, p_category, p_icon_key, p_color_key, mask, p_reminder_times,
    p_goal_target, p_goal_unit, p_time_of_day, p_frequency, p_per_week, p_interval_days);
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    p_habit_id, p_expected_revision, clean_title, p_category, p_icon_key, p_color_key,
    mask, coalesce(p_reminder_times, '{}'),
    p_goal_target, p_goal_unit, p_time_of_day, p_frequency, p_per_week, p_interval_days
  )::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.update', digest);
  if previous is not null then
    return previous;
  end if;

  select * into existing from public.habits
    where id = p_habit_id and owner_id = uid and archived_at is null
    for update;
  if not found then
    raise exception 'habit_not_found' using errcode = 'PT404';
  end if;
  if existing.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  update public.habits
    set title = clean_title, category = p_category, icon_key = p_icon_key, color_key = p_color_key,
        goal_target = p_goal_target, goal_unit = p_goal_unit, time_of_day = p_time_of_day,
        revision = revision + 1, updated_at = statement_timestamp()
    where id = p_habit_id;

  -- NOTE: Новое расписание действует с сегодняшнего дня. Прошлые дни остаются по старой версии.
  today := public.current_schedule_date(uid);
  select time_zone into tz from public.profiles where id = uid;
  insert into public.habit_schedules(owner_id, habit_id, effective_from, weekday_mask, time_zone,
      reminder_times, frequency, per_week, interval_days)
    values (uid, p_habit_id, today, mask, tz, coalesce(p_reminder_times, '{}'), p_frequency,
      case when p_frequency = 'weekly' then p_per_week end,
      case when p_frequency = 'interval' then p_interval_days end)
    on conflict (habit_id, effective_from) do update
      set weekday_mask = excluded.weekday_mask,
          time_zone = excluded.time_zone,
          reminder_times = excluded.reminder_times,
          frequency = excluded.frequency,
          per_week = excluded.per_week,
          interval_days = excluded.interval_days;

  -- NOTE: Новая цель сразу действует для сегодняшней отметки (прошлые дни не трогаем).
  update public.daily_plan_items i
    set target = p_goal_target,
        status = case
          when i.status = 'skipped' then i.status
          when i.progress >= p_goal_target then 'completed'
          else 'pending'
        end,
        completed_at = case
          when i.status <> 'skipped' and i.progress >= p_goal_target
            then coalesce(i.completed_at, statement_timestamp())
          else null
        end,
        revision = i.revision + 1,
        updated_at = statement_timestamp()
    from public.daily_plans dp
    where dp.id = i.plan_id and dp.owner_id = uid and dp.local_date = today
      and i.habit_id = p_habit_id and i.target <> p_goal_target;

  return public.receipt_store(uid, p_request_id, 'habit.update', digest,
    pg_catalog.jsonb_build_object('habit_id', p_habit_id, 'revision', existing.revision + 1));
end;
$$;

drop function public.list_active_habits();
create function public.list_active_habits()
returns table (
  id uuid,
  title text,
  category text,
  icon_key text,
  color_key text,
  revision integer,
  weekday_mask smallint,
  reminder_times time[],
  created_at timestamptz,
  goal_target integer,
  goal_unit text,
  time_of_day text,
  frequency text,
  per_week smallint,
  interval_days smallint
) language sql stable security invoker set search_path = '' as $$
  select h.id, h.title, h.category, h.icon_key, h.color_key, h.revision,
         s.weekday_mask, s.reminder_times, h.created_at,
         h.goal_target, h.goal_unit, h.time_of_day, s.frequency, s.per_week, s.interval_days
  from public.habits h
  join lateral (
    select hs.weekday_mask, hs.reminder_times, hs.frequency, hs.per_week, hs.interval_days
    from public.habit_schedules hs
    where hs.habit_id = h.id and hs.owner_id = h.owner_id
      and hs.effective_from <= (statement_timestamp() at time zone hs.time_zone)::date
    order by hs.effective_from desc
    limit 1
  ) s on true
  where h.archived_at is null
  order by h.created_at;
$$;

-- Сколько раз привычка выполнена за неделю (с понедельника) до указанного дня, не включая его.
create function public.week_completions(p_owner uuid, p_habit uuid, p_day date, p_include_day boolean)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.daily_plan_items i
  join public.daily_plans dp on dp.id = i.plan_id
  where i.owner_id = p_owner and i.habit_id = p_habit and i.status = 'completed'
    and dp.local_date >= p_day - (extract(isodow from p_day)::integer - 1)
    and (dp.local_date < p_day or (p_include_day and dp.local_date = p_day));
$$;

drop function public.open_today_plan();
create function public.open_today_plan()
returns table (
  item_id uuid,
  habit_id uuid,
  title text,
  icon_key text,
  color_key text,
  status text,
  revision integer,
  completed_at timestamptz,
  local_date date,
  target integer,
  progress integer,
  flexible boolean,
  goal_unit text,
  time_of_day text,
  week_done integer,
  per_week smallint
) language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  tz text;
  today date;
  plan uuid;
  is_new boolean;
begin
  select p.time_zone into tz from public.profiles p where p.id = uid;
  today := (statement_timestamp() at time zone tz)::date;

  insert into public.daily_plans(owner_id, local_date, time_zone)
    values (uid, today, tz)
    on conflict (owner_id, local_date) do nothing
    returning id into plan;
  is_new := plan is not null;
  if not is_new then
    select dp.id into plan from public.daily_plans dp where dp.owner_id = uid and dp.local_date = today;
  end if;

  -- NOTE: План фиксируется при первом показе; позже добавляются только привычки, созданные сегодня.
  -- «N раз в неделю» попадает в план, пока недельная норма не выполнена.
  insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id, title_snapshot,
      icon_snapshot, color_snapshot, target, flexible)
  select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key, h.goal_target, s.frequency = 'weekly'
  from public.habits h
  join lateral (
    select hs.id, hs.weekday_mask, hs.frequency, hs.per_week, hs.interval_days, hs.effective_from
    from public.habit_schedules hs
    where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= today
    order by hs.effective_from desc limit 1
  ) s on true
  where h.owner_id = uid
    and h.archived_at is null
    and (
      public.schedule_due(s.frequency, s.weekday_mask, s.interval_days, s.effective_from, today)
      or (s.frequency = 'weekly' and public.week_completions(uid, h.id, today, false) < s.per_week)
    )
    and (is_new or (h.created_at at time zone tz)::date = today)
  order by h.created_at
  on conflict (plan_id, habit_id) do nothing;

  return query
    select i.id, i.habit_id, h.title, h.icon_key, h.color_key,
           i.status, i.revision, i.completed_at, today,
           i.target, i.progress, i.flexible, h.goal_unit, h.time_of_day,
           case when i.flexible then public.week_completions(uid, h.id, today, true) else 0 end,
           s.per_week
    from public.daily_plan_items i
    join public.habits h on h.id = i.habit_id
    left join public.habit_schedules s on s.id = i.schedule_id
    where i.plan_id = plan
      and (h.archived_at is null or i.status <> 'pending')
    order by h.created_at, i.id;
end;
$$;

-- REFACTOR: Отметка, отмена и отдых теперь учитывают прогресс количественной цели.
create or replace function public.set_plan_item_status(
  p_request_id uuid, p_item_id uuid, p_expected_revision integer, p_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  item public.daily_plan_items%rowtype;
  plan_day date;
  today date;
  operation text;
begin
  if p_status is null or p_status not in ('completed', 'pending', 'skipped') then
    raise exception 'invalid_status' using errcode = 'PT422';
  end if;
  operation := 'plan.' || p_status;
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_item_id, p_expected_revision, p_status)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, operation, digest);
  if previous is not null then
    return previous;
  end if;

  select * into item from public.daily_plan_items
    where id = p_item_id and owner_id = uid
    for update;
  if not found then
    raise exception 'plan_item_not_found' using errcode = 'PT404';
  end if;
  select dp.local_date into plan_day from public.daily_plans dp where dp.id = item.plan_id;
  today := public.current_schedule_date(uid);
  if plan_day <> today then
    raise exception 'day_closed' using errcode = 'PT409';
  end if;
  if item.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  -- NOTE: Удержание выполняет цель целиком; отмена обнуляет прогресс; отдых его сохраняет.
  update public.daily_plan_items
    set status = p_status,
        progress = case p_status
          when 'completed' then greatest(progress, target)
          when 'pending' then 0
          else progress
        end,
        completed_at = case when p_status = 'completed' then statement_timestamp() else null end,
        revision = revision + 1,
        updated_at = statement_timestamp()
    where id = p_item_id;

  return public.receipt_store(uid, p_request_id, operation, digest,
    pg_catalog.jsonb_build_object('item_id', p_item_id, 'revision', item.revision + 1, 'status', p_status));
end;
$$;

-- Прибавить к сегодняшней отметке (+1 стакан, −1 страница). Цель достигнута — отметка выполнена.
create function public.add_plan_progress(
  p_request_id uuid, p_item_id uuid, p_expected_revision integer, p_delta integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  item public.daily_plan_items%rowtype;
  plan_day date;
  next_progress integer;
  next_status text;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'invalid_amount' using errcode = 'PT422';
  end if;
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_item_id, p_expected_revision, p_delta)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'plan.progress', digest);
  if previous is not null then
    return previous;
  end if;

  select * into item from public.daily_plan_items
    where id = p_item_id and owner_id = uid
    for update;
  if not found then
    raise exception 'plan_item_not_found' using errcode = 'PT404';
  end if;
  select dp.local_date into plan_day from public.daily_plans dp where dp.id = item.plan_id;
  if plan_day <> public.current_schedule_date(uid) then
    raise exception 'day_closed' using errcode = 'PT409';
  end if;
  if item.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  -- NOTE: Можно перевыполнить цель (9 стаканов из 8), но не больше чем в десять раз.
  next_progress := greatest(0, least(item.progress + p_delta, item.target * 10));
  next_status := case when next_progress >= item.target then 'completed' else 'pending' end;
  update public.daily_plan_items
    set progress = next_progress,
        status = next_status,
        completed_at = case
          when next_status = 'completed' then coalesce(item.completed_at, statement_timestamp())
        end,
        revision = revision + 1,
        updated_at = statement_timestamp()
    where id = p_item_id;

  return public.receipt_store(uid, p_request_id, 'plan.progress', digest,
    pg_catalog.jsonb_build_object('item_id', p_item_id, 'revision', item.revision + 1,
      'status', next_status, 'progress', next_progress));
end;
$$;

-- REFACTOR: Календарь знает новые графики; «N раз в неделю» не делает день пропущенным.
create or replace function public.calendar_days(p_from date, p_to date)
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
           (count(i.id) filter (where not i.flexible or i.status = 'completed'))::integer as planned,
           (count(i.id) filter (where i.status = 'completed'))::integer as completed,
           (count(i.id) filter (where i.status = 'skipped' and not i.flexible))::integer as skipped
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
      select hs.weekday_mask, hs.frequency, hs.interval_days, hs.effective_from
      from public.habit_schedules hs
      where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= d.day
      order by hs.effective_from desc limit 1
    ) s on true
    where public.schedule_due(s.frequency, s.weekday_mask, s.interval_days, s.effective_from, d.day)
    group by d.day
  )
  select d.day,
         coalesce(o.planned, r.planned, 0),
         coalesce(o.completed, 0),
         coalesce(o.skipped, 0),
         case
           when coalesce(o.planned, r.planned, 0) = 0 then 'rest'
           when o.planned is not null and o.completed >= o.planned then 'completed'
           else 'missed'
         end
  from days d
  left join opened o on o.day = d.day
  left join reconstructed r on r.day = d.day
  order by d.day;
end;
$$;

-- История привычки по дням с прогрессом цели (кадр 09).
drop function public.habit_days(uuid, integer);
create function public.habit_days(p_habit_id uuid, p_days integer default 30)
returns table (local_date date, status text, progress integer, target integer)
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
           -- NOTE: «N раз в неделю»: невыполненный день — не пропуск, а свободный день.
           when i.status = 'pending' and i.flexible then case when d.day = today then 'pending' else 'rest' end
           when i.status = 'pending' then case when d.day = today then 'pending' else 'missed' end
           when dp.id is not null
                and (d.day < today or (habit.created_at at time zone tz)::date < today) then 'rest'
           when (habit.archived_at is not null and (habit.archived_at at time zone tz)::date <= d.day)
             then 'rest'
           when s.frequency is not null
                and public.schedule_due(s.frequency, s.weekday_mask, s.interval_days, s.effective_from, d.day)
             then case when d.day = today then 'pending' else 'missed' end
           else 'rest'
         end,
         coalesce(i.progress, 0),
         coalesce(i.target, habit.goal_target)
  from days d
  left join public.daily_plans dp on dp.owner_id = uid and dp.local_date = d.day
  left join public.daily_plan_items i on i.plan_id = dp.id and i.habit_id = habit.id
  left join lateral (
    select hs.weekday_mask, hs.frequency, hs.interval_days, hs.effective_from
    from public.habit_schedules hs
    where hs.habit_id = habit.id and hs.owner_id = uid and hs.effective_from <= d.day
    order by hs.effective_from desc limit 1
  ) s on true
  order by d.day desc;
end;
$$;

-- Фокус для привычки: в сессии хранится привычка, по окончании минуты засчитываются в неё.
create or replace function public.focus_json(s public.focus_sessions) returns jsonb
  language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', s.id, 'phase', s.phase, 'status', s.status, 'duration_ms', s.duration_ms,
    'remaining_ms', s.remaining_ms, 'deadline_at', s.deadline_at, 'revision', s.revision,
    'habit_id', s.habit_id);
$$;

-- Засчитать закончившееся занятие в привычку на сегодня:
--   цель в минутах — прибавляются отработанные минуты (и при «Завершить раньше»);
--   другая цель — полное занятие выполняет её целиком.
create function public.focus_credit(p_session public.focus_sessions) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  minutes integer;
  unit text;
  item public.daily_plan_items%rowtype;
  delta integer;
  next_progress integer;
begin
  if p_session.habit_id is null or p_session.phase <> 'focus'
     or p_session.status not in ('completed', 'ended_early') then
    return;
  end if;
  minutes := case p_session.status
    when 'completed' then p_session.duration_ms / 60000
    else (p_session.duration_ms - coalesce(p_session.remaining_ms, 0)) / 60000
  end;
  select h.goal_unit into unit from public.habits h where h.id = p_session.habit_id;
  select i.* into item
    from public.daily_plan_items i
    join public.daily_plans dp on dp.id = i.plan_id
    where i.owner_id = p_session.owner_id and i.habit_id = p_session.habit_id
      and dp.local_date = public.current_schedule_date(p_session.owner_id)
    for update of i;
  if not found or item.status = 'skipped' then
    return;
  end if;
  delta := case
    when unit = 'minutes' then minutes
    when p_session.status = 'completed' then greatest(item.target - item.progress, 0)
    else 0
  end;
  if delta <= 0 then
    return;
  end if;
  next_progress := least(item.progress + delta, item.target * 10);
  update public.daily_plan_items
    set progress = next_progress,
        status = case when next_progress >= item.target then 'completed' else item.status end,
        completed_at = case
          when next_progress >= item.target then coalesce(item.completed_at, statement_timestamp())
          else item.completed_at
        end,
        revision = revision + 1,
        updated_at = statement_timestamp()
    where id = item.id;
end;
$$;

create or replace function public.focus_settle(p_owner uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  settled public.focus_sessions%rowtype;
begin
  for settled in
    update public.focus_sessions
      set status = 'completed', finished_at = deadline_at, revision = revision + 1
      where owner_id = p_owner and status = 'running' and deadline_at <= statement_timestamp()
      returning *
  loop
    perform public.focus_credit(settled);
  end loop;
end;
$$;

drop function public.start_focus(uuid, text);
create function public.start_focus(p_request_id uuid, p_phase text, p_habit_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  created public.focus_sessions%rowtype;
  duration integer;
  habit uuid := case when p_phase = 'focus' then p_habit_id end;
begin
  if p_phase is null or p_phase not in ('focus', 'break') then
    raise exception 'invalid_phase' using errcode = 'PT422';
  end if;
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_phase, habit)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'focus.start', digest);
  if previous is not null then
    return previous;
  end if;
  if habit is not null and not exists (
    select 1 from public.habits h where h.id = habit and h.owner_id = uid and h.archived_at is null
  ) then
    raise exception 'habit_not_found' using errcode = 'PT404';
  end if;

  perform public.focus_settle(uid);
  duration := case p_phase when 'focus' then 1500000 else 300000 end;
  begin
    insert into public.focus_sessions(owner_id, phase, status, duration_ms, deadline_at, started_at, habit_id)
      values (uid, p_phase, 'running', duration,
              statement_timestamp() + duration * interval '1 millisecond', statement_timestamp(), habit)
      returning * into created;
  exception when unique_violation then
    raise exception 'focus_active' using errcode = 'PT409';
  end;
  return public.receipt_store(uid, p_request_id, 'focus.start', digest, public.focus_json(created));
end;
$$;

-- REFACTOR: «Завершить раньше» тоже засчитывает отработанные минуты в привычку.
create or replace function public.change_focus(
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
  if current_row.status = 'running' and current_row.deadline_at <= statement_timestamp() then
    perform public.focus_settle(uid);
    select * into current_row from public.focus_sessions where id = p_session_id;
  end if;
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
    update public.focus_sessions
      set status = case p_action when 'finish' then 'ended_early' else 'reset' end,
          remaining_ms = left_ms, deadline_at = null,
          finished_at = statement_timestamp(), revision = revision + 1
      where id = p_session_id returning * into changed;
    perform public.focus_credit(changed);
  else
    raise exception 'invalid_action' using errcode = 'PT422';
  end if;

  return public.receipt_store(uid, p_request_id, operation, digest, public.focus_json(changed));
end;
$$;

-- Итоги недели: по каждой привычке — запланировано, выполнено, прогресс; минуты фокуса.
create function public.week_summary(p_week_start date) returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  tz text;
  today date;
  week_start date;
  week_end date;
begin
  select p.time_zone into tz from public.profiles p where p.id = uid;
  today := (statement_timestamp() at time zone tz)::date;
  -- NOTE: Неделя всегда с понедельника, даже если передан другой день.
  week_start := p_week_start - (extract(isodow from p_week_start)::integer - 1);
  week_end := week_start + 6;
  return pg_catalog.jsonb_build_object(
    'week_start', week_start,
    'habits', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'habit_id', h.id, 'title', h.title, 'icon_key', h.icon_key, 'color_key', h.color_key,
        'goal_unit', h.goal_unit, 'per_week', s.per_week,
        'planned', x.planned, 'completed', x.completed, 'progress', x.progress
      ) order by h.created_at)
      from public.habits h
      left join lateral (
        select hs.per_week from public.habit_schedules hs
        where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= week_end
        order by hs.effective_from desc limit 1
      ) s on true
      join lateral (
        select (count(*) filter (where d.status <> 'rest'))::integer as planned,
               (count(*) filter (where d.status = 'completed'))::integer as completed,
               coalesce(sum(d.progress), 0)::integer as progress
        from public.habit_days(h.id, (today - week_start + 1)) d
        where d.local_date between week_start and week_end
      ) x on true
      where h.owner_id = uid
        and (h.created_at at time zone tz)::date <= week_end
        and (h.archived_at is null or (h.archived_at at time zone tz)::date >= week_start)
    ), '[]'::jsonb),
    'focus_minutes', (
      select coalesce(sum(case fs.status
               when 'completed' then fs.duration_ms
               else fs.duration_ms - coalesce(fs.remaining_ms, 0) end), 0) / 60000
      from public.focus_sessions fs
      where fs.owner_id = uid and fs.phase = 'focus' and fs.status in ('completed', 'ended_early')
        and (fs.finished_at at time zone tz)::date between week_start and week_end
    ));
end;
$$;

-- REFACTOR: Полный день для награды — без невыполненных «N раз в неделю»: их сегодня можно не делать.
create or replace function public.claim_day_reward(p_request_id uuid) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  today date := public.current_schedule_date(uid);
  digest text := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(today)::text, 'UTF8')), 'hex');
  previous jsonb;
  due integer;
  done integer;
  inserted boolean;
begin
  previous := public.receipt_lookup(uid, p_request_id, 'garden.claim_day', digest);
  if previous is not null then
    return previous;
  end if;

  select count(*) filter (where i.status <> 'skipped' and (not i.flexible or i.status = 'completed')),
         count(*) filter (where i.status = 'completed')
    into due, done
    from public.daily_plans dp
    join public.daily_plan_items i on i.plan_id = dp.id
    where dp.owner_id = uid and dp.local_date = today;
  if coalesce(due, 0) = 0 or done < due then
    raise exception 'day_not_complete' using errcode = 'PT409';
  end if;

  insert into public.day_rewards(owner_id, local_date, completed)
    values (uid, today, done)
    on conflict (owner_id, local_date) do nothing;
  inserted := found;

  return public.receipt_store(uid, p_request_id, 'garden.claim_day', digest,
    pg_catalog.jsonb_build_object('granted', inserted, 'local_date', today, 'completed', done));
end;
$$;

revoke all on function public.schedule_due(text, smallint, smallint, date, date) from public, anon, authenticated;
revoke all on function public.validate_habit_input(text, text, text, text, smallint, time[], integer, text, text, text, smallint, smallint) from public, anon, authenticated;
revoke all on function public.week_completions(uuid, uuid, date, boolean) from public, anon, authenticated;
revoke all on function public.focus_credit(public.focus_sessions) from public, anon, authenticated;
revoke all on function public.focus_settle(uuid) from public, anon, authenticated;
revoke all on function public.focus_json(public.focus_sessions) from public, anon, authenticated;
revoke all on function public.set_plan_item_status(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.change_focus(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.create_habit(uuid, text, text, text, text, smallint, time[], integer, text, text, text, smallint, smallint) from public, anon;
revoke all on function public.update_habit(uuid, uuid, integer, text, text, text, text, smallint, time[], integer, text, text, text, smallint, smallint) from public, anon;
revoke all on function public.list_active_habits() from public, anon;
revoke all on function public.open_today_plan() from public, anon;
revoke all on function public.add_plan_progress(uuid, uuid, integer, integer) from public, anon;
revoke all on function public.habit_days(uuid, integer) from public, anon;
revoke all on function public.start_focus(uuid, text, uuid) from public, anon;
revoke all on function public.week_summary(date) from public, anon;
grant execute on function public.create_habit(uuid, text, text, text, text, smallint, time[], integer, text, text, text, smallint, smallint) to authenticated;
grant execute on function public.update_habit(uuid, uuid, integer, text, text, text, text, smallint, time[], integer, text, text, text, smallint, smallint) to authenticated;
grant execute on function public.list_active_habits() to authenticated;
grant execute on function public.open_today_plan() to authenticated;
grant execute on function public.add_plan_progress(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.habit_days(uuid, integer) to authenticated;
grant execute on function public.start_focus(uuid, text, uuid) to authenticated;
grant execute on function public.week_summary(date) to authenticated;
commit;
