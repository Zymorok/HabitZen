-- NOTE: HZ-04. План на день: фиксация плана, отметка, отмена, «Сегодня отдых», серия и чужие отметки.
begin;
insert into auth.users values
  ('12000000-0000-0000-0000-000000000001'),
  ('12000000-0000-0000-0000-000000000002');
-- NOTE: Профиль «создан» неделю назад, чтобы проверить восстановление прошлых дней.
update public.profiles
  set created_at = statement_timestamp() - interval '7 days'
  where id = '12000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
do $$
declare
  today_bit smallint := (1 << (extract(isodow from (statement_timestamp() at time zone 'UTC')::date)::integer - 1))::smallint;
  other_bit smallint;
  item record;
  repeated jsonb;
  first_result jsonb;
begin
  other_bit := (127 # today_bit)::smallint;
  perform public.create_habit('cccccccc-0000-0000-0000-000000000001', 'Вода', 'water', 'drop', 'blue', 127::smallint);
  perform public.create_habit('cccccccc-0000-0000-0000-000000000002', 'Чтение', 'reading', 'book', 'sage', today_bit);
  -- NOTE: Эта привычка сегодня не запланирована и в план попасть не должна.
  perform public.create_habit('cccccccc-0000-0000-0000-000000000003', 'Не сегодня', 'custom', 'sun', 'rose', other_bit);

  if (select count(*) from public.open_today_plan()) <> 2 then
    raise exception 'FAIL: в план попали не те привычки';
  end if;
  if (select count(*) from public.open_today_plan()) <> 2 then
    raise exception 'FAIL: повторное открытие плана добавило лишнее';
  end if;
  if (select count(*) from public.daily_plans) <> 1 then
    raise exception 'FAIL: открылось больше одного плана на день';
  end if;

  -- NOTE: Привычка, созданная сегодня после открытия плана, добавляется в сегодняшний план.
  perform public.create_habit('cccccccc-0000-0000-0000-000000000004', 'Прогулка', 'fitness', 'walk', 'apricot', 127::smallint);
  if (select count(*) from public.open_today_plan()) <> 3 then
    raise exception 'FAIL: новая сегодняшняя привычка не попала в план';
  end if;

  select * into item from public.open_today_plan() where title = 'Вода';
  perform pg_catalog.set_config('test.item', item.item_id::text, true);
  first_result := public.complete_plan_item('dddddddd-0000-0000-0000-000000000001', item.item_id, item.revision);
  repeated := public.complete_plan_item('dddddddd-0000-0000-0000-000000000001', item.item_id, item.revision);
  if first_result <> repeated then raise exception 'FAIL: повтор отметки дал другой результат'; end if;
  if (select status from public.open_today_plan() where item_id = item.item_id) <> 'completed' then
    raise exception 'FAIL: отметка не сохранена';
  end if;
  if (select completed_at from public.open_today_plan() where item_id = item.item_id) is null then
    raise exception 'FAIL: нет времени выполнения';
  end if;
  if (select revision from public.open_today_plan() where item_id = item.item_id) <> 2 then
    raise exception 'FAIL: повтор отметки увеличил версию дважды';
  end if;

  begin
    perform public.complete_plan_item('dddddddd-0000-0000-0000-000000000002', item.item_id, 1);
    raise exception 'FAIL: принята отметка по устаревшей версии';
  exception when sqlstate 'PT409' then null; end;

  perform public.undo_plan_item('dddddddd-0000-0000-0000-000000000003', item.item_id, 2);
  if (select status from public.open_today_plan() where item_id = item.item_id) <> 'pending' then
    raise exception 'FAIL: отметка не отменилась';
  end if;
  if (select completed_at from public.open_today_plan() where item_id = item.item_id) is not null then
    raise exception 'FAIL: после отмены осталось время выполнения';
  end if;

  select * into item from public.open_today_plan() where title = 'Чтение';
  perform public.skip_plan_item('dddddddd-0000-0000-0000-000000000004', item.item_id, item.revision);
  if (select status from public.open_today_plan() where item_id = item.item_id) <> 'skipped' then
    raise exception 'FAIL: «Сегодня отдых» не сохранён';
  end if;

  begin
    perform public.set_plan_item_status('dddddddd-0000-0000-0000-000000000005', item.item_id, 2, 'completed');
    raise exception 'FAIL: клиент вызывает служебную функцию';
  exception when insufficient_privilege then null; end;

  -- NOTE: Неделя до сегодняшнего дня: планов не открывали, но «Вода» запланирована на каждый день.
  -- Однако привычки созданы сегодня, поэтому прошлые дни — отдых, а не пропуски.
  if (select count(*) from public.day_outcomes(30) where outcome = 'missed' and local_date < (statement_timestamp() at time zone 'UTC')::date) <> 0 then
    raise exception 'FAIL: дни до создания привычки засчитаны как пропуски';
  end if;
  if (select outcome from public.day_outcomes(30) where local_date = (statement_timestamp() at time zone 'UTC')::date) <> 'missed' then
    raise exception 'FAIL: незавершённый сегодняшний день посчитан неверно';
  end if;
end $$;

-- NOTE: Привычка «существовала» три дня назад — восстановленный прошлый день без отметок становится пропуском.
reset role;
update public.habits set created_at = statement_timestamp() - interval '3 days'
  where owner_id = '12000000-0000-0000-0000-000000000001' and title = 'Прогулка';
update public.habit_schedules set effective_from = (statement_timestamp() at time zone 'UTC')::date - 3
  where habit_id = (select id from public.habits where title = 'Прогулка');
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select outcome from public.day_outcomes(30)
      where local_date = (statement_timestamp() at time zone 'UTC')::date - 1) <> 'missed' then
    raise exception 'FAIL: вчерашний запланированный день без отметки не стал пропуском';
  end if;
  if (select outcome from public.day_outcomes(30)
      where local_date = (statement_timestamp() at time zone 'UTC')::date - 5) <> 'rest' then
    raise exception 'FAIL: день до появления привычки не стал отдыхом';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
do $$
declare
  item uuid := current_setting('test.item')::uuid;
begin
  if (select count(*) from public.open_today_plan()) <> 0 then raise exception 'FAIL: видны чужие отметки'; end if;
  begin
    perform public.complete_plan_item('eeeeeeee-0000-0000-0000-000000000001', item, 3);
    raise exception 'FAIL: отмечена чужая привычка';
  exception when sqlstate 'PT404' then null; end;
end $$;

-- NOTE: Прошлый день не переписывается.
reset role;
update public.daily_plans set local_date = local_date - 1
  where owner_id = '12000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
do $$
declare
  item uuid := current_setting('test.item')::uuid;
begin
  begin
    perform public.complete_plan_item('dddddddd-0000-0000-0000-000000000009', item, 3);
    raise exception 'FAIL: изменён вчерашний план';
  exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
rollback;
