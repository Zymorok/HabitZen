-- NOTE: HZ-03. Команды привычек — единственный путь записи для клиента.
-- Каждая команда: проверенный пользователь, номер запроса (requestId), ожидаемая версия строки,
-- одна транзакция. Повтор того же запроса возвращает прежний результат и ничего не делает заново.
--
-- Коды ошибок для приложения (PostgREST превращает PTxxx в HTTP-статус xxx):
--   PT401 not_authenticated   — нет проверенной сессии
--   PT404 habit_not_found     — привычки нет или она чужая (не различаем, чтобы не выдавать чужие id)
--   PT409 revision_conflict   — запись изменилась на другом устройстве
--   PT409 request_conflict    — тот же requestId пришёл с другим содержимым
--   PT422 invalid_*           — неверные данные формы
begin;

-- Сегодняшняя дата в часовом поясе владельца: с неё вступает в силу новое расписание.
create function public.current_schedule_date(p_owner uuid) returns date
  language sql stable security definer set search_path = '' as $$
  select (statement_timestamp() at time zone p.time_zone)::date
  from public.profiles p where p.id = p_owner;
$$;

-- Квитанция запроса: блокирует пару (владелец, requestId) до конца транзакции и возвращает
-- сохранённый результат, если этот запрос уже выполнялся.
create function public.receipt_lookup(
  p_owner uuid, p_request_id uuid, p_operation text, p_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  stored public.mutation_receipts%rowtype;
begin
  -- NOTE: Два одновременных повтора одного запроса выстраиваются в очередь на этом замке.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner::text || ':' || p_request_id::text, 0)
  );
  select * into stored from public.mutation_receipts
    where owner_id = p_owner and request_id = p_request_id;
  if not found then
    return null;
  end if;
  if stored.operation <> p_operation or stored.payload_digest <> p_digest then
    raise exception 'request_conflict' using errcode = 'PT409';
  end if;
  return stored.result;
end;
$$;

create function public.receipt_store(
  p_owner uuid, p_request_id uuid, p_operation text, p_digest text, p_result jsonb
) returns jsonb language sql security definer set search_path = '' as $$
  insert into public.mutation_receipts(owner_id, request_id, operation, payload_digest, result)
  values (p_owner, p_request_id, p_operation, p_digest, p_result);
  select p_result;
$$;

create function public.require_user() returns uuid
  language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  return uid;
end;
$$;

create function public.validate_habit_input(
  p_title text, p_category text, p_icon_key text, p_color_key text,
  p_weekday_mask smallint, p_reminder_times time[]
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
  if p_weekday_mask is null or p_weekday_mask not between 1 and 127 then
    raise exception 'invalid_schedule' using errcode = 'PT422';
  end if;
  if pg_catalog.cardinality(coalesce(p_reminder_times, '{}')) > 4 then
    raise exception 'invalid_reminders' using errcode = 'PT422';
  end if;
  return clean_title;
end;
$$;

create function public.create_habit(
  p_request_id uuid,
  p_title text,
  p_category text,
  p_icon_key text,
  p_color_key text,
  p_weekday_mask smallint,
  p_reminder_times time[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  clean_title text;
  digest text;
  previous jsonb;
  new_habit uuid;
  tz text;
begin
  clean_title := public.validate_habit_input(
    p_title, p_category, p_icon_key, p_color_key, p_weekday_mask, p_reminder_times);
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    clean_title, p_category, p_icon_key, p_color_key, p_weekday_mask, coalesce(p_reminder_times, '{}')
  )::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.create', digest);
  if previous is not null then
    return previous;
  end if;

  select time_zone into tz from public.profiles where id = uid;
  insert into public.habits(owner_id, title, category, icon_key, color_key)
    values (uid, clean_title, p_category, p_icon_key, p_color_key)
    returning id into new_habit;
  insert into public.habit_schedules(owner_id, habit_id, effective_from, weekday_mask, time_zone, reminder_times)
    values (uid, new_habit, public.current_schedule_date(uid), p_weekday_mask, tz, coalesce(p_reminder_times, '{}'));

  return public.receipt_store(uid, p_request_id, 'habit.create', digest,
    pg_catalog.jsonb_build_object('habit_id', new_habit, 'revision', 1));
end;
$$;

create function public.update_habit(
  p_request_id uuid,
  p_habit_id uuid,
  p_expected_revision integer,
  p_title text,
  p_category text,
  p_icon_key text,
  p_color_key text,
  p_weekday_mask smallint,
  p_reminder_times time[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  clean_title text;
  digest text;
  previous jsonb;
  existing public.habits%rowtype;
  today date;
  tz text;
begin
  clean_title := public.validate_habit_input(
    p_title, p_category, p_icon_key, p_color_key, p_weekday_mask, p_reminder_times);
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
    p_habit_id, p_expected_revision, clean_title, p_category, p_icon_key, p_color_key,
    p_weekday_mask, coalesce(p_reminder_times, '{}')
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
        revision = revision + 1, updated_at = statement_timestamp()
    where id = p_habit_id;

  -- NOTE: Новое расписание действует с сегодняшнего дня. Прошлые дни остаются по старой версии.
  today := public.current_schedule_date(uid);
  select time_zone into tz from public.profiles where id = uid;
  insert into public.habit_schedules(owner_id, habit_id, effective_from, weekday_mask, time_zone, reminder_times)
    values (uid, p_habit_id, today, p_weekday_mask, tz, coalesce(p_reminder_times, '{}'))
    on conflict (habit_id, effective_from) do update
      set weekday_mask = excluded.weekday_mask,
          time_zone = excluded.time_zone,
          reminder_times = excluded.reminder_times;

  return public.receipt_store(uid, p_request_id, 'habit.update', digest,
    pg_catalog.jsonb_build_object('habit_id', p_habit_id, 'revision', existing.revision + 1));
end;
$$;

create function public.archive_habit(
  p_request_id uuid, p_habit_id uuid, p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  digest text;
  previous jsonb;
  existing public.habits%rowtype;
begin
  digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_habit_id, p_expected_revision)::text, 'UTF8')), 'hex');
  previous := public.receipt_lookup(uid, p_request_id, 'habit.archive', digest);
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

  -- NOTE: Архив, а не удаление: история выполнений и прошлые планы остаются целыми.
  update public.habits
    set archived_at = statement_timestamp(), revision = revision + 1, updated_at = statement_timestamp()
    where id = p_habit_id;

  return public.receipt_store(uid, p_request_id, 'habit.archive', digest,
    pg_catalog.jsonb_build_object('habit_id', p_habit_id, 'revision', existing.revision + 1));
end;
$$;

-- Чтение: активные привычки владельца с действующим расписанием. Работает с правами
-- вызывающего (security invoker), поэтому строки отбирает RLS.
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
  created_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  select h.id, h.title, h.category, h.icon_key, h.color_key, h.revision,
         s.weekday_mask, s.reminder_times, h.created_at
  from public.habits h
  join lateral (
    select hs.weekday_mask, hs.reminder_times
    from public.habit_schedules hs
    where hs.habit_id = h.id and hs.owner_id = h.owner_id
      and hs.effective_from <= (statement_timestamp() at time zone hs.time_zone)::date
    order by hs.effective_from desc
    limit 1
  ) s on true
  where h.archived_at is null
  order by h.created_at;
$$;

-- WARNING: Вспомогательные функции не вызываются клиентом напрямую.
revoke all on function public.current_schedule_date(uuid) from public, anon, authenticated;
revoke all on function public.receipt_lookup(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.receipt_store(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.require_user() from public, anon, authenticated;
revoke all on function public.validate_habit_input(text, text, text, text, smallint, time[]) from public, anon, authenticated;

revoke all on function public.create_habit(uuid, text, text, text, text, smallint, time[]) from public, anon;
revoke all on function public.update_habit(uuid, uuid, integer, text, text, text, text, smallint, time[]) from public, anon;
revoke all on function public.archive_habit(uuid, uuid, integer) from public, anon;
revoke all on function public.list_active_habits() from public, anon;
grant execute on function public.create_habit(uuid, text, text, text, text, smallint, time[]) to authenticated;
grant execute on function public.update_habit(uuid, uuid, integer, text, text, text, text, smallint, time[]) to authenticated;
grant execute on function public.archive_habit(uuid, uuid, integer) to authenticated;
grant execute on function public.list_active_habits() to authenticated;

-- TODO(HZ-07): Очистка старых квитанций (например, старше 30 дней) отдельной плановой задачей.
commit;
