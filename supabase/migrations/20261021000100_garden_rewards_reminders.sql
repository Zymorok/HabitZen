-- NOTE: HZ-06. Дерево (кадр 10), награда за полный день (кадр 11) и время напоминания (кадр 12).
-- Счётчики не принимаются от клиента: рост дерева выводится из подтверждённых выполнений,
-- награда выдаётся сервером один раз за день и только за действительно завершённый план.
--   PT409 day_not_complete — в сегодняшнем плане ещё есть невыполненные привычки
begin;

-- Время общего вечернего напоминания из «Настроек»; включатель — reminders_enabled.
alter table public.user_settings
  add column reminder_time time not null default '21:00';
grant update (reminder_time) on public.user_settings to authenticated;

-- Награды за полный день: одна строка на день, отмена отметки её не забирает.
create table public.day_rewards (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  completed integer not null check (completed > 0),
  granted_at timestamptz not null default now(),
  primary key (owner_id, local_date)
);
revoke all on public.day_rewards from public, anon, authenticated;
alter table public.day_rewards enable row level security;
create policy rewards_read on public.day_rewards for select to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.day_rewards to authenticated;

-- Состояние сада: сколько всего выполнено (одна отметка — один вклад, отмена его убирает),
-- сколько было полных дней и получена ли сегодняшняя награда.
create function public.garden_state() returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  today date := public.current_schedule_date(uid);
begin
  return pg_catalog.jsonb_build_object(
    'completed_total', (select count(*) from public.daily_plan_items i
                        where i.owner_id = uid and i.status = 'completed'),
    'perfect_days', (select count(*) from public.day_rewards r where r.owner_id = uid),
    'reward_today', exists (select 1 from public.day_rewards r
                            where r.owner_id = uid and r.local_date = today),
    'today', today);
end;
$$;

-- Награда за сегодняшний день: выдаётся, только если все запланированные привычки
-- (кроме «Сегодня отдых») выполнены. Повтор возвращает тот же ответ, второй награды нет.
create function public.claim_day_reward(p_request_id uuid) returns jsonb
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

  select count(*) filter (where i.status <> 'skipped'),
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

revoke all on function public.garden_state() from public, anon;
revoke all on function public.claim_day_reward(uuid) from public, anon;
grant execute on function public.garden_state() to authenticated;
grant execute on function public.claim_day_reward(uuid) to authenticated;
commit;
