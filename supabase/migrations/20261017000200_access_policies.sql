-- NOTE: Все данные закрыты по умолчанию. Права выдаются явно.
begin;
revoke all on public.profiles, public.user_settings, public.habits, public.habit_schedules,
  public.daily_plans, public.daily_plan_items, public.focus_sessions, public.mutation_receipts
  from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.habits enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.daily_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.mutation_receipts enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_edit on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy settings_read on public.user_settings for select to authenticated
  using (owner_id = (select auth.uid()));
create policy settings_edit on public.user_settings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy habits_read on public.habits for select to authenticated
  using (owner_id = (select auth.uid()));
create policy schedules_read on public.habit_schedules for select to authenticated
  using (owner_id = (select auth.uid()));
create policy plans_read on public.daily_plans for select to authenticated
  using (owner_id = (select auth.uid()));
create policy items_read on public.daily_plan_items for select to authenticated
  using (owner_id = (select auth.uid()));
create policy focus_read on public.focus_sessions for select to authenticated
  using (owner_id = (select auth.uid()));
-- WARNING: Квитанции действий не выдаются мобильному клиенту обычным чтением таблицы.
-- TODO(HZ-03): Команды привычек и таймера откроют только именованные RPC после тестов транзакций.

grant select on public.profiles, public.user_settings, public.habits, public.habit_schedules,
  public.daily_plans, public.daily_plan_items, public.focus_sessions to authenticated;
grant update (display_name, time_zone, language_preference) on public.profiles to authenticated;
grant update (theme, sounds_enabled, haptics_enabled, reminders_enabled, reduced_motion, focus_sound)
  on public.user_settings to authenticated;
commit;

