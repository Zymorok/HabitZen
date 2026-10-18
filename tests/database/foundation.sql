-- NOTE: Проверяются ограничения и права двух пользователей, а не работа настоящего Auth-сервера.
begin;
insert into auth.users values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'FAIL: создание профилей'; end if;
  if (select count(*) from public.user_settings) <> 2 then raise exception 'FAIL: создание настроек'; end if;
end $$;

insert into public.habits (id, owner_id, title, category, icon_key, color_key) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Читать','reading','book','sage'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Вода','water','drop','mint');

do $$ begin
  begin
    insert into public.habit_schedules(owner_id,habit_id,effective_from,weekday_mask,time_zone)
      values ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2026-10-17',127,'UTC');
    raise exception 'FAIL: разрешена чужая связь';
  exception when foreign_key_violation then null; end;
  begin
    update public.profiles set time_zone = 'Wrong/Zone' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: принят неверный часовой пояс';
  exception when check_violation then null; end;
  begin
    insert into public.habit_schedules(owner_id,habit_id,effective_from,weekday_mask,time_zone)
      values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-17',0,'UTC');
    raise exception 'FAIL: принято пустое расписание';
  exception when check_violation then null; end;
end $$;

insert into public.habit_schedules(id,owner_id,habit_id,effective_from,weekday_mask,time_zone)
  values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-17',127,'Europe/Warsaw');
insert into public.daily_plans(id,owner_id,local_date,time_zone)
  values ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-10-17','Europe/Warsaw');
insert into public.daily_plan_items(owner_id,plan_id,habit_id,schedule_id,title_snapshot,icon_snapshot,color_snapshot)
  values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Читать','book','sage');

do $$ begin
  begin
    insert into public.daily_plan_items(owner_id,plan_id,habit_id,schedule_id,title_snapshot,icon_snapshot,color_snapshot)
      values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Читать','book','sage');
    raise exception 'FAIL: повтор привычки в плане';
  exception when unique_violation then null; end;
  begin
    update public.daily_plan_items set status='completed';
    raise exception 'FAIL: выполнено без времени выполнения';
  exception when check_violation then null; end;
end $$;

insert into public.focus_sessions(owner_id,phase,status,duration_ms,deadline_at)
  values ('10000000-0000-0000-0000-000000000001','focus','running',1500000,now()+interval '25 minutes');
do $$ begin
  begin
    insert into public.focus_sessions(owner_id,phase,status,duration_ms,deadline_at)
      values ('10000000-0000-0000-0000-000000000001','break','running',300000,now()+interval '5 minutes');
    raise exception 'FAIL: разрешены две активные сессии';
  exception when unique_violation then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: видны чужие профили'; end if;
  if (select count(*) from public.habits) <> 1 then raise exception 'FAIL: видны чужие привычки'; end if;
  if (select count(*) from public.user_settings) <> 1 then raise exception 'FAIL: видны чужие настройки'; end if;
  update public.profiles set language_preference='uk' where id='10000000-0000-0000-0000-000000000001';
  if (select language_preference from public.profiles) <> 'uk' then raise exception 'FAIL: язык не сохранён'; end if;
  begin
    update public.profiles set language_preference='invalid' where id='10000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: принят неизвестный язык';
  exception when check_violation then null; end;
  update public.profiles set display_name='Свой профиль' where id='10000000-0000-0000-0000-000000000001';
  if not found then raise exception 'FAIL: свой профиль нельзя изменить'; end if;
  update public.profiles set display_name='Взлом' where id='10000000-0000-0000-0000-000000000002';
  if found then raise exception 'FAIL: чужой профиль изменён'; end if;
  begin
    insert into public.habits(owner_id,title,category,icon_key,color_key)
      values ('10000000-0000-0000-0000-000000000001','Подмена','custom','book','sage');
    raise exception 'FAIL: открыта прямая запись привычек';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.mutation_receipts;
    raise exception 'FAIL: открыты внутренние квитанции';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.daily_plans) <> 0 then raise exception 'FAIL: виден чужой план'; end if;
  if (select count(*) from public.daily_plan_items) <> 0 then raise exception 'FAIL: видны чужие отметки'; end if;
  if (select count(*) from public.focus_sessions) <> 0 then raise exception 'FAIL: виден чужой таймер'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: анонимное чтение разрешено';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: проверки ограничений, создания профилей и изоляции двух пользователей' as result;

