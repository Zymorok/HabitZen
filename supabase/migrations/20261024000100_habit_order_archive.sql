-- NOTE: HZ-09. Свой порядок привычек, архив с возвратом и начало расписания для напоминаний
-- «каждый N-й день». Прежние миграции не меняются: функции пересоздаются здесь.
begin;

-- Порядок привычек: у новых — в конец списка, у существующих — по дате создания.
alter table public.habits add column sort_order integer not null default 0;
update public.habits h
  set sort_order = r.position
  from (
    select id, row_number() over (partition by owner_id order by created_at, id) as position
    from public.habits
  ) r
  where r.id = h.id;
create index habits_owner_order on public.habits(owner_id, sort_order) where archived_at is null;

create function public.habit_sort_order_default() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(h.sort_order), 0) + 1 into new.sort_order
      from public.habits h where h.owner_id = new.owner_id;
  end if;
  return new;
end;
$$;
create trigger habits_sort_order before insert on public.habits
  for each row execute function public.habit_sort_order_default();

-- REFACTOR: Список привычек — в порядке владельца и с началом расписания (для интервала).
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
  interval_days smallint,
  schedule_from date,
  sort_order integer
) language sql stable security invoker set search_path = '' as $$
  select h.id, h.title, h.category, h.icon_key, h.color_key, h.revision,
         s.weekday_mask, s.reminder_times, h.created_at,
         h.goal_target, h.goal_unit, h.time_of_day, s.frequency, s.per_week, s.interval_days,
         s.effective_from, h.sort_order
  from public.habits h
  join lateral (
    select hs.weekday_mask, hs.reminder_times, hs.frequency, hs.per_week, hs.interval_days,
           hs.effective_from
    from public.habit_schedules hs
    where hs.habit_id = h.id and hs.owner_id = h.owner_id
      and hs.effective_from <= (statement_timestamp() at time zone hs.time_zone)::date
    order by hs.effective_from desc
    limit 1
  ) s on true
  where h.archived_at is null
  order by h.sort_order, h.created_at;
$$;

-- Архив: что можно вернуть. Свежие сверху.
create function public.list_archived_habits()
returns table (
  id uuid,
  title text,
  icon_key text,
  color_key text,
  revision integer,
  archived_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  select h.id, h.title, h.icon_key, h.color_key, h.revision, h.archived_at
  from public.habits h
  where h.archived_at is not null
  order by h.archived_at desc, h.id;
$$;

-- REFACTOR: План дня идёт в порядке, который выбрал человек.
create or replace function public.open_today_plan()
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
  order by h.sort_order, h.created_at
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
    order by h.sort_order, h.created_at, i.id;
end;
$$;

-- REFACTOR: «Итоги недели» — в том же порядке привычек.
create or replace function public.week_summary(p_week_start date) returns jsonb
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
      ) order by h.sort_order, h.created_at)
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

-- Новый порядок: полный список активных привычек владельца. Неполный или устаревший — PT409.
create function public.reorder_habits(p_request_id uuid, p_habit_ids uuid[]) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  active integer;
  matched integer;
begin
  if p_habit_ids is null or pg_catalog.cardinality(p_habit_ids) = 0
     or pg_catalog.cardinality(p_habit_ids) > 200
     or pg_catalog.cardinality(p_habit_ids)
        <> (select count(distinct x) from pg_catalog.unnest(p_habit_ids) x) then
    raise exception 'invalid_order' using errcode = 'PT422';
  end if;
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.to_jsonb(p_habit_ids)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.reorder', digest);
  if previous is not null then
    return previous;
  end if;

  -- NOTE: Блокируем список, чтобы две вкладки не перемешали порядок одновременно.
  perform 1 from public.habits h where h.owner_id = uid and h.archived_at is null for update;
  select count(*) into active from public.habits h where h.owner_id = uid and h.archived_at is null;
  select count(*) into matched from public.habits h
    where h.owner_id = uid and h.archived_at is null and h.id = any(p_habit_ids);
  if matched <> pg_catalog.cardinality(p_habit_ids) then
    raise exception 'habit_not_found' using errcode = 'PT404';
  end if;
  if matched <> active then
    raise exception 'order_stale' using errcode = 'PT409';
  end if;

  -- NOTE: Порядок — не содержимое привычки: версия не растёт, открытая форма изменения не устаревает.
  update public.habits h
    set sort_order = o.position, updated_at = statement_timestamp()
    from pg_catalog.unnest(p_habit_ids) with ordinality as o(habit_id, position)
    where h.id = o.habit_id and h.owner_id = uid;

  return public.receipt_store(uid, p_request_id, 'habit.reorder', digest,
    pg_catalog.jsonb_build_object('count', matched));
end;
$$;

-- Возврат из архива: привычка встаёт в конец списка и, если сегодня положена, — в план дня.
create function public.restore_habit(
  p_request_id uuid, p_habit_id uuid, p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  existing public.habits%rowtype;
  today date := public.current_schedule_date(uid);
  plan uuid;
begin
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_habit_id, p_expected_revision)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.restore', digest);
  if previous is not null then
    return previous;
  end if;

  select * into existing from public.habits
    where id = p_habit_id and owner_id = uid and archived_at is not null
    for update;
  if not found then
    raise exception 'habit_not_found' using errcode = 'PT404';
  end if;
  if existing.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  update public.habits
    set archived_at = null,
        revision = revision + 1,
        sort_order = (select coalesce(max(h.sort_order), 0) + 1 from public.habits h
                      where h.owner_id = uid and h.archived_at is null),
        updated_at = statement_timestamp()
    where id = p_habit_id;

  -- NOTE: Строка сегодняшнего плана, если была до архива, вернётся сама; иначе добавляем.
  select dp.id into plan from public.daily_plans dp where dp.owner_id = uid and dp.local_date = today;
  if plan is not null then
    insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id, title_snapshot,
        icon_snapshot, color_snapshot, target, flexible)
    select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key, h.goal_target,
           s.frequency = 'weekly'
    from public.habits h
    join lateral (
      select hs.id, hs.weekday_mask, hs.frequency, hs.per_week, hs.interval_days, hs.effective_from
      from public.habit_schedules hs
      where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= today
      order by hs.effective_from desc limit 1
    ) s on true
    where h.id = p_habit_id
      and (
        public.schedule_due(s.frequency, s.weekday_mask, s.interval_days, s.effective_from, today)
        or (s.frequency = 'weekly' and public.week_completions(uid, h.id, today, false) < s.per_week)
      )
    on conflict (plan_id, habit_id) do nothing;
  end if;

  return public.receipt_store(uid, p_request_id, 'habit.restore', digest,
    pg_catalog.jsonb_build_object('habit_id', p_habit_id, 'revision', existing.revision + 1));
end;
$$;

revoke all on function public.habit_sort_order_default() from public, anon, authenticated;
revoke all on function public.list_active_habits() from public, anon;
revoke all on function public.list_archived_habits() from public, anon;
revoke all on function public.reorder_habits(uuid, uuid[]) from public, anon;
revoke all on function public.restore_habit(uuid, uuid, integer) from public, anon;
grant execute on function public.list_active_habits() to authenticated;
grant execute on function public.list_archived_habits() to authenticated;
grant execute on function public.reorder_habits(uuid, uuid[]) to authenticated;
grant execute on function public.restore_habit(uuid, uuid, integer) to authenticated;
commit;
