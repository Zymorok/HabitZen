-- NOTE: HZ-04. План на день и отметки. Те же правила, что у команд привычек (HZ-03):
-- проверенный пользователь, номер запроса, ожидаемая версия строки, одна транзакция.
--   PT404 plan_item_not_found — отметки нет или она чужая
--   PT409 revision_conflict    — отметка изменилась на другом устройстве
--   PT409 day_closed           — прошлые дни не переписываются
--   PT422 invalid_status       — неизвестное состояние
begin;

-- План на сегодня в поясе профиля. Первый показ создаёт и фиксирует план по действующим
-- расписаниям. Если план уже есть, в него добавляются только привычки, созданные сегодня:
-- изменение расписания задним числом сегодняшний план не переписывает.
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
  local_date date
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

  insert into public.daily_plan_items(owner_id, plan_id, habit_id, schedule_id, title_snapshot, icon_snapshot, color_snapshot)
  select uid, plan, h.id, s.id, h.title, h.icon_key, h.color_key
  from public.habits h
  join lateral (
    select hs.id, hs.weekday_mask from public.habit_schedules hs
    where hs.habit_id = h.id and hs.owner_id = uid and hs.effective_from <= today
    order by hs.effective_from desc limit 1
  ) s on true
  where h.owner_id = uid
    and h.archived_at is null
    -- NOTE: Бит 0 — понедельник; isodow: понедельник = 1.
    and (s.weekday_mask & (1 << (extract(isodow from today)::integer - 1))) <> 0
    and (is_new or (h.created_at at time zone tz)::date = today)
  order by h.created_at
  on conflict (plan_id, habit_id) do nothing;

  return query
    -- NOTE: Сегодня показываем актуальные название и вид: правка привычки видна сразу.
    -- Снимок в строке плана остаётся для истории прошлых дней.
    select i.id, i.habit_id, h.title, h.icon_key, h.color_key,
           i.status, i.revision, i.completed_at, today
    from public.daily_plan_items i
    join public.habits h on h.id = i.habit_id
    where i.plan_id = plan
      -- NOTE: Убранная в архив привычка исчезает из невыполненного, но выполненное остаётся в истории.
      and (h.archived_at is null or i.status <> 'pending')
    order by h.created_at, i.id;
end;
$$;

create function public.set_plan_item_status(
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

  update public.daily_plan_items
    set status = p_status,
        completed_at = case when p_status = 'completed' then statement_timestamp() else null end,
        revision = revision + 1,
        updated_at = statement_timestamp()
    where id = p_item_id;

  return public.receipt_store(uid, p_request_id, operation, digest,
    pg_catalog.jsonb_build_object('item_id', p_item_id, 'revision', item.revision + 1, 'status', p_status));
end;
$$;

-- Понятные имена для приложения: отметить, отменить отметку, «Сегодня отдых».
create function public.complete_plan_item(p_request_id uuid, p_item_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.set_plan_item_status(p_request_id, p_item_id, p_expected_revision, 'completed');
$$;
create function public.undo_plan_item(p_request_id uuid, p_item_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.set_plan_item_status(p_request_id, p_item_id, p_expected_revision, 'pending');
$$;
create function public.skip_plan_item(p_request_id uuid, p_item_id uuid, p_expected_revision integer)
returns jsonb language sql security definer set search_path = '' as $$
  select public.set_plan_item_status(p_request_id, p_item_id, p_expected_revision, 'skipped');
$$;

-- Итог каждого дня для серии «N дней подряд»: с момента создания профиля, не больше года.
-- Дни, когда план не открывался, восстанавливаются по расписаниям того дня: запланированная,
-- но не отмеченная привычка — пропуск, незапланированный день — отдых (нейтрален).
create function public.day_outcomes(p_days integer default 120)
returns table (local_date date, planned integer, completed integer, outcome text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := public.require_user();
  tz text;
  today date;
  first_day date;
begin
  select p.time_zone, (p.created_at at time zone p.time_zone)::date into tz, first_day
    from public.profiles p where p.id = uid;
  today := (statement_timestamp() at time zone tz)::date;
  first_day := greatest(first_day, today - least(greatest(coalesce(p_days, 120), 1), 366));

  return query
  with days as (
    select g::date as day from pg_catalog.generate_series(first_day, today, interval '1 day') g
  ),
  opened as (
    select dp.local_date as day,
           count(i.id)::integer as planned,
           (count(i.id) filter (where i.status = 'completed'))::integer as completed
    from public.daily_plans dp
    join public.daily_plan_items i on i.plan_id = dp.id
    where dp.owner_id = uid and dp.local_date between first_day and today
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

revoke all on function public.set_plan_item_status(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.open_today_plan() from public, anon;
revoke all on function public.complete_plan_item(uuid, uuid, integer) from public, anon;
revoke all on function public.undo_plan_item(uuid, uuid, integer) from public, anon;
revoke all on function public.skip_plan_item(uuid, uuid, integer) from public, anon;
revoke all on function public.day_outcomes(integer) from public, anon;
grant execute on function public.open_today_plan() to authenticated;
grant execute on function public.complete_plan_item(uuid, uuid, integer) to authenticated;
grant execute on function public.undo_plan_item(uuid, uuid, integer) to authenticated;
grant execute on function public.skip_plan_item(uuid, uuid, integer) to authenticated;
grant execute on function public.day_outcomes(integer) to authenticated;
commit;
