-- NOTE: Начальная схема. Изменения после применения оформляются новой миграцией.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Пользователь' check (char_length(display_name) between 1 and 80),
  time_zone text not null default 'UTC',
  language_preference text not null default 'system'
    check (language_preference in ('system', 'ru', 'uk', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  sounds_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  reminders_enabled boolean not null default false,
  reduced_motion boolean not null default false,
  focus_sound text not null default 'none' check (focus_sound in ('none', 'rain', 'forest', 'white_noise')),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('water', 'reading', 'fitness', 'meditation', 'learning', 'custom')),
  icon_key text not null check (char_length(icon_key) between 1 and 40),
  color_key text not null check (color_key in ('sage', 'mint', 'apricot', 'sand', 'blue', 'rose')),
  revision integer not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  habit_id uuid not null,
  effective_from date not null,
  -- NOTE: Биты 0–6 означают понедельник–воскресенье. Нулевое расписание запрещено.
  weekday_mask smallint not null check (weekday_mask between 1 and 127),
  time_zone text not null,
  reminder_times time[] not null default '{}' check (cardinality(reminder_times) <= 4),
  created_at timestamptz not null default now(),
  foreign key (habit_id, owner_id) references public.habits(id, owner_id) on delete cascade,
  unique (habit_id, effective_from),
  unique (id, habit_id, owner_id)
);

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  time_zone text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, local_date),
  unique (id, owner_id)
);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null,
  habit_id uuid not null,
  schedule_id uuid not null,
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 120),
  icon_snapshot text not null,
  color_snapshot text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, owner_id) references public.daily_plans(id, owner_id) on delete cascade,
  foreign key (habit_id, owner_id) references public.habits(id, owner_id),
  foreign key (schedule_id, habit_id, owner_id) references public.habit_schedules(id, habit_id, owner_id),
  unique (plan_id, habit_id),
  unique (id, owner_id),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('focus', 'break')),
  status text not null check (status in ('running', 'paused', 'completed', 'ended_early', 'reset')),
  duration_ms integer not null check (duration_ms in (300000, 1500000)),
  remaining_ms integer check (remaining_ms between 0 and duration_ms),
  deadline_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  check ((phase = 'focus' and duration_ms = 1500000) or (phase = 'break' and duration_ms = 300000)),
  check (
    (status = 'running' and deadline_at is not null and remaining_ms is null and finished_at is null)
    or (status = 'paused' and deadline_at is null and remaining_ms is not null and finished_at is null)
    or (status in ('completed', 'ended_early', 'reset') and finished_at is not null)
  )
);

create unique index focus_sessions_one_active_per_owner
  on public.focus_sessions(owner_id) where status in ('running', 'paused');
create index habits_owner_active on public.habits(owner_id, created_at) where archived_at is null;
create index habit_schedules_owner_habit on public.habit_schedules(owner_id, habit_id, effective_from desc);
create index daily_plan_items_owner_plan on public.daily_plan_items(owner_id, plan_id);
create index daily_plan_items_schedule on public.daily_plan_items(schedule_id, habit_id, owner_id);
create index daily_plan_items_habit_owner on public.daily_plan_items(habit_id, owner_id);
create index focus_sessions_owner_started on public.focus_sessions(owner_id, started_at desc);

create table public.mutation_receipts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation ~ '^[a-z][a-z0-9_.]{1,80}$'),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);
create index mutation_receipts_created on public.mutation_receipts(created_at);

create function public.validate_time_zone() returns trigger language plpgsql
  set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Недопустимый часовой пояс' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.touch_updated_at() returns trigger language plpgsql
  set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger profiles_time_zone before insert or update on public.profiles
  for each row execute function public.validate_time_zone();
create trigger schedules_time_zone before insert or update on public.habit_schedules
  for each row execute function public.validate_time_zone();
create trigger plans_time_zone before insert or update on public.daily_plans
  for each row execute function public.validate_time_zone();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger settings_updated before update on public.user_settings
  for each row execute function public.touch_updated_at();

create function public.bootstrap_profile() returns trigger language plpgsql
  security definer set search_path = '' as $$
begin
  -- NOTE: Метаданные клиента не выдаются за проверенные настройки или права пользователя.
  insert into public.profiles(id) values (new.id);
  insert into public.user_settings(owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.bootstrap_profile();

revoke all on function public.validate_time_zone() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.bootstrap_profile() from public, anon, authenticated;

comment on table public.daily_plans is 'Снимок плана дня: смена расписания не переписывает историю.';
comment on table public.mutation_receipts is 'Квитанция запроса: повтор не выполняет действие заново.';
comment on table public.daily_plan_items is 'Единственный результат привычки в плане дня; запись через будущие транзакционные функции.';

commit;

