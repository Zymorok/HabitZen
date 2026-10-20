-- NOTE: HZ-09. Свой порядок привычек, архив с возвратом и начало расписания в списке.
begin;
insert into auth.users values
  ('17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
do $$
declare
  a uuid;
  b uuid;
  c uuid;
  result jsonb;
  repeated jsonb;
  revision_before integer;
begin
  perform public.create_habit('aaaa0000-0000-0000-0000-000000000001', 'Вода', 'water', 'drop', 'blue',
    127::smallint, '{}');
  perform public.create_habit('aaaa0000-0000-0000-0000-000000000002', 'Чтение', 'reading', 'book', 'sand',
    127::smallint, '{}');
  perform public.create_habit('aaaa0000-0000-0000-0000-000000000003', 'Прогулка', 'fitness', 'walk', 'mint',
    127::smallint, '{}', 1, 'times', 'any', 'interval', null, 3::smallint);
  select id into a from public.list_active_habits() where title = 'Вода';
  select id into b from public.list_active_habits() where title = 'Чтение';
  select id into c from public.list_active_habits() where title = 'Прогулка';

  -- NOTE: Новые привычки встают в конец списка по очереди создания.
  if (select pg_catalog.array_agg(title order by sort_order) from public.list_active_habits())
     <> array['Вода', 'Чтение', 'Прогулка'] then
    raise exception 'FAIL: новые привычки не встали в конец списка';
  end if;
  if (select schedule_from from public.list_active_habits() where id = c)
     <> (select local_date from public.open_today_plan() limit 1) then
    raise exception 'FAIL: в списке нет начала расписания';
  end if;

  select revision into revision_before from public.list_active_habits() where id = a;
  result := public.reorder_habits('aaaa1111-0000-0000-0000-000000000001', array[c, a, b]);
  repeated := public.reorder_habits('aaaa1111-0000-0000-0000-000000000001', array[c, a, b]);
  if result <> repeated then raise exception 'FAIL: повтор порядка дал другой ответ'; end if;
  if (select pg_catalog.array_agg(id) from public.list_active_habits()) <> array[c, a, b] then
    raise exception 'FAIL: список не в новом порядке';
  end if;
  if (select pg_catalog.array_agg(habit_id) from public.open_today_plan()) <> array[c, a, b] then
    raise exception 'FAIL: план дня не в новом порядке';
  end if;
  if (select revision from public.list_active_habits() where id = a) <> revision_before then
    raise exception 'FAIL: порядок изменил версию привычки';
  end if;

  begin
    perform public.reorder_habits('aaaa1111-0000-0000-0000-000000000002', array[a, b]);
    raise exception 'FAIL: принят неполный порядок';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.reorder_habits('aaaa1111-0000-0000-0000-000000000003', array[a, a, b]);
    raise exception 'FAIL: принят порядок с повтором';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.reorder_habits('aaaa1111-0000-0000-0000-000000000004', array[]::uuid[]);
    raise exception 'FAIL: принят пустой порядок';
  exception when sqlstate 'PT422' then null; end;
  begin
    perform public.reorder_habits('aaaa1111-0000-0000-0000-000000000005',
      array[a, b, c, 'aaaa9999-0000-0000-0000-000000000001'::uuid]);
    raise exception 'FAIL: принят порядок с незнакомой привычкой';
  exception when sqlstate 'PT404' then null; end;

  -- NOTE: Архив — и порядок без архивной привычки снова полный.
  perform public.archive_habit('aaaa2222-0000-0000-0000-000000000001', b,
    (select revision from public.list_active_habits() where id = b));
  if exists (select 1 from public.list_active_habits() where id = b)
     or not exists (select 1 from public.list_archived_habits() where id = b) then
    raise exception 'FAIL: архив не отделил привычку';
  end if;
  perform public.reorder_habits('aaaa1111-0000-0000-0000-000000000006', array[a, c]);

  begin
    perform public.restore_habit('aaaa3333-0000-0000-0000-000000000001', b, 1);
    raise exception 'FAIL: возврат по старой версии';
  exception when sqlstate 'PT409' then null; end;
  select revision into revision_before from public.list_archived_habits() where id = b;
  result := public.restore_habit('aaaa3333-0000-0000-0000-000000000002', b, revision_before);
  repeated := public.restore_habit('aaaa3333-0000-0000-0000-000000000002', b, revision_before);
  if result <> repeated then raise exception 'FAIL: повтор возврата дал другой ответ'; end if;
  if (select pg_catalog.array_agg(id) from public.list_active_habits()) <> array[a, c, b]
     or exists (select 1 from public.list_archived_habits()) then
    raise exception 'FAIL: возвращённая привычка не в конце списка';
  end if;
  if not exists (select 1 from public.open_today_plan() where habit_id = b and status = 'pending') then
    raise exception 'FAIL: возвращённая привычка не вернулась в план';
  end if;
  begin
    perform public.restore_habit('aaaa3333-0000-0000-0000-000000000003', b,
      (select revision from public.list_active_habits() where id = b));
    raise exception 'FAIL: возвращена привычка, которая не в архиве';
  exception when sqlstate 'PT404' then null; end;
  if (select pg_catalog.array_agg(h ->> 'title')
      from pg_catalog.jsonb_array_elements(public.week_summary(current_date) -> 'habits') h)
     <> array['Вода', 'Прогулка', 'Чтение'] then
    raise exception 'FAIL: итоги недели не в порядке списка';
  end if;

  -- NOTE: Привычку, созданную раньше и убранную в архив до открытия плана, возврат добавляет в план.
  perform public.create_habit('aaaa0000-0000-0000-0000-000000000004', 'Растяжка', 'fitness', 'walk', 'rose',
    127::smallint, '{}');
  perform public.archive_habit('aaaa2222-0000-0000-0000-000000000002',
    (select id from public.list_active_habits() where title = 'Растяжка'), 1);
  perform pg_catalog.set_config('test.habit',
    (select id::text from public.list_archived_habits() where title = 'Растяжка'), true);
end $$;

reset role;
-- NOTE: Строку плана удаляем как владелец базы: так проверяется, что её добавляет сам возврат.
delete from public.daily_plan_items where habit_id = current_setting('test.habit')::uuid;
update public.habits set created_at = created_at - interval '3 days'
  where id = current_setting('test.habit')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
do $$
begin
  perform public.restore_habit('aaaa3333-0000-0000-0000-000000000004',
    current_setting('test.habit')::uuid, 2);
  if not exists (select 1 from public.open_today_plan()
                 where habit_id = current_setting('test.habit')::uuid) then
    raise exception 'FAIL: возврат не добавил привычку в сегодняшний план';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000002', true);
do $$
begin
  if exists (select 1 from public.list_archived_habits()) then
    raise exception 'FAIL: виден чужой архив';
  end if;
  begin
    perform public.restore_habit('bbbb3333-0000-0000-0000-000000000001',
      current_setting('test.habit')::uuid, 3);
    raise exception 'FAIL: возвращена чужая привычка';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.reorder_habits('bbbb1111-0000-0000-0000-000000000001',
      array[current_setting('test.habit')::uuid]);
    raise exception 'FAIL: переставлена чужая привычка';
  exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
rollback;
