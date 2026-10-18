-- NOTE: HZ-03. Команды привычек: права, повтор запроса, конфликт версии и изоляция двух аккаунтов.
begin;
insert into auth.users values
  ('11000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002');
update public.profiles set time_zone = 'Europe/Warsaw' where id = '11000000-0000-0000-0000-000000000001';

set local role anon;
do $$ begin
  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000000', 'Анон', 'custom', 'leaf', 'sage', 127::smallint);
    raise exception 'FAIL: аноним создал привычку';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000009', 'Без входа', 'custom', 'leaf', 'sage', 127::smallint);
    raise exception 'FAIL: команда без проверенного пользователя';
  exception when sqlstate 'PT401' then null; end;
end $$;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
declare
  first_result jsonb;
  repeated jsonb;
  habit uuid;
begin
  first_result := public.create_habit('aaaaaaaa-0000-0000-0000-000000000001', '  Читать 20 минут ', 'reading', 'book', 'sage', 31::smallint, array['21:00']::time[]);
  repeated := public.create_habit('aaaaaaaa-0000-0000-0000-000000000001', '  Читать 20 минут ', 'reading', 'book', 'sage', 31::smallint, array['21:00']::time[]);
  if first_result <> repeated then raise exception 'FAIL: повтор запроса вернул другой результат'; end if;
  if (select count(*) from public.habits) <> 1 then raise exception 'FAIL: повтор запроса создал вторую привычку'; end if;
  if (select title from public.list_active_habits()) <> 'Читать 20 минут' then raise exception 'FAIL: пробелы в названии не убраны'; end if;
  if (select weekday_mask from public.list_active_habits()) <> 31 then raise exception 'FAIL: расписание не сохранено'; end if;
  if (select time_zone from public.habit_schedules) <> 'Europe/Warsaw' then raise exception 'FAIL: пояс расписания не взят из профиля'; end if;

  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000001', 'Другое', 'reading', 'book', 'sage', 31::smallint);
    raise exception 'FAIL: тот же requestId с другим содержимым принят';
  exception when sqlstate 'PT409' then null; end;

  habit := (first_result ->> 'habit_id')::uuid;
  perform pg_catalog.set_config('test.habit', habit::text, true);

  perform public.update_habit('aaaaaaaa-0000-0000-0000-000000000002', habit, 1, 'Читать 30 минут', 'reading', 'book', 'mint', 127::smallint);
  if (select revision from public.habits where id = habit) <> 2 then raise exception 'FAIL: версия не увеличилась'; end if;
  if (select weekday_mask from public.list_active_habits()) <> 127 then raise exception 'FAIL: новое расписание не действует'; end if;
  if (select count(*) from public.habit_schedules) <> 1 then raise exception 'FAIL: изменение в тот же день создало лишнюю версию расписания'; end if;

  begin
    perform public.update_habit('aaaaaaaa-0000-0000-0000-000000000003', habit, 1, 'Старое', 'reading', 'book', 'sage', 127::smallint);
    raise exception 'FAIL: принято изменение устаревшей версии';
  exception when sqlstate 'PT409' then null; end;

  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000004', '   ', 'custom', 'leaf', 'sage', 1::smallint);
    raise exception 'FAIL: принято пустое название';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000005', 'Ок', 'custom', 'leaf', 'sage', 0::smallint);
    raise exception 'FAIL: принято расписание без дней';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000006', 'Ок', 'unknown', 'leaf', 'sage', 1::smallint);
    raise exception 'FAIL: принята неизвестная категория';
  exception when sqlstate 'PT422' then null; end;

  begin
    perform count(*) from public.mutation_receipts;
    raise exception 'FAIL: клиент читает квитанции напрямую';
  exception when insufficient_privilege then null; end;
  begin
    perform public.receipt_store('11000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007', 'habit.create', repeat('0', 64), '{}'::jsonb);
    raise exception 'FAIL: клиент вызывает служебную функцию';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
do $$
declare
  habit uuid := current_setting('test.habit')::uuid;
begin
  if (select count(*) from public.list_active_habits()) <> 0 then raise exception 'FAIL: видны чужие привычки'; end if;
  begin
    perform public.update_habit('bbbbbbbb-0000-0000-0000-000000000001', habit, 2, 'Взлом', 'custom', 'leaf', 'sage', 127::smallint);
    raise exception 'FAIL: изменена чужая привычка';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.archive_habit('bbbbbbbb-0000-0000-0000-000000000002', habit, 2);
    raise exception 'FAIL: заархивирована чужая привычка';
  exception when sqlstate 'PT404' then null; end;
  -- NOTE: Номера запросов разных аккаунтов независимы.
  perform public.create_habit('aaaaaaaa-0000-0000-0000-000000000001', 'Вода', 'water', 'drop', 'mint', 127::smallint);
  if (select count(*) from public.list_active_habits()) <> 1 then raise exception 'FAIL: второй аккаунт не создал свою привычку'; end if;
end $$;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
do $$
declare
  habit uuid := current_setting('test.habit')::uuid;
  archived jsonb;
begin
  archived := public.archive_habit('aaaaaaaa-0000-0000-0000-000000000008', habit, 2);
  if (select count(*) from public.list_active_habits()) <> 0 then raise exception 'FAIL: архивная привычка в активном списке'; end if;
  if (select count(*) from public.habits) <> 1 then raise exception 'FAIL: архив удалил привычку'; end if;
  if public.archive_habit('aaaaaaaa-0000-0000-0000-000000000008', habit, 2) <> archived then
    raise exception 'FAIL: повтор архивации дал другой результат';
  end if;
end $$;
reset role;
rollback;
