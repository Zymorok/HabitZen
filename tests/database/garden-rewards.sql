-- NOTE: HZ-06. Рост дерева из выполнений, однократная награда за полный день, время напоминания.
begin;
insert into auth.users values
  ('14000000-0000-0000-0000-000000000001'),
  ('14000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);
do $$
declare
  state jsonb;
  item record;
  reward jsonb;
  repeated jsonb;
begin
  state := public.garden_state();
  if (state ->> 'completed_total')::integer <> 0 or (state ->> 'reward_today')::boolean then
    raise exception 'FAIL: у нового аккаунта не пустой сад';
  end if;

  perform public.create_habit('aaaa3333-0000-0000-0000-000000000001', 'Вода', 'water', 'drop', 'blue', 127::smallint);
  perform public.create_habit('aaaa3333-0000-0000-0000-000000000002', 'Чтение', 'reading', 'book', 'sage', 127::smallint);
  perform public.create_habit('aaaa3333-0000-0000-0000-000000000003', 'Прогулка', 'fitness', 'walk', 'apricot', 127::smallint);

  begin
    perform public.claim_day_reward('aaaa4444-0000-0000-0000-000000000001');
    raise exception 'FAIL: награда за пустой день';
  exception when sqlstate 'PT409' then null; end;

  select * into item from public.open_today_plan() where title = 'Вода';
  perform public.complete_plan_item('aaaa4444-0000-0000-0000-000000000002', item.item_id, item.revision);
  begin
    perform public.claim_day_reward('aaaa4444-0000-0000-0000-000000000003');
    raise exception 'FAIL: награда за неполный день';
  exception when sqlstate 'PT409' then null; end;
  if (public.garden_state() ->> 'completed_total')::integer <> 1 then
    raise exception 'FAIL: выполнение не попало в рост дерева';
  end if;

  select * into item from public.open_today_plan() where title = 'Чтение';
  perform public.complete_plan_item('aaaa4444-0000-0000-0000-000000000004', item.item_id, item.revision);
  -- NOTE: «Сегодня отдых» не мешает полному дню.
  select * into item from public.open_today_plan() where title = 'Прогулка';
  perform public.skip_plan_item('aaaa4444-0000-0000-0000-000000000005', item.item_id, item.revision);

  reward := public.claim_day_reward('aaaa4444-0000-0000-0000-000000000006');
  if not (reward ->> 'granted')::boolean or (reward ->> 'completed')::integer <> 2 then
    raise exception 'FAIL: награда за полный день не выдана';
  end if;
  repeated := public.claim_day_reward('aaaa4444-0000-0000-0000-000000000006');
  if repeated <> reward then raise exception 'FAIL: повтор запроса дал другой ответ'; end if;
  if (public.claim_day_reward('aaaa4444-0000-0000-0000-000000000007') ->> 'granted')::boolean then
    raise exception 'FAIL: вторая награда за тот же день';
  end if;
  if (select count(*) from public.day_rewards) <> 1 then
    raise exception 'FAIL: награда записана дважды';
  end if;

  -- NOTE: Отмена отметки уменьшает рост дерева, но выданную награду не забирает.
  select * into item from public.open_today_plan() where title = 'Вода';
  perform public.undo_plan_item('aaaa4444-0000-0000-0000-000000000008', item.item_id, item.revision);
  state := public.garden_state();
  if (state ->> 'completed_total')::integer <> 1 then
    raise exception 'FAIL: отмена не убрала вклад в дерево';
  end if;
  if not (state ->> 'reward_today')::boolean or (state ->> 'perfect_days')::integer <> 1 then
    raise exception 'FAIL: отмена забрала уже выданную награду';
  end if;

  begin
    insert into public.day_rewards(owner_id, local_date, completed)
      values ('14000000-0000-0000-0000-000000000001', current_date - 1, 5);
    raise exception 'FAIL: клиент выдал себе награду напрямую';
  exception when insufficient_privilege then null; end;

  update public.user_settings set reminder_time = '08:30', reminders_enabled = true
    where owner_id = '14000000-0000-0000-0000-000000000001';
  if (select reminder_time from public.user_settings) <> '08:30'::time then
    raise exception 'FAIL: время напоминания не сохранилось';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000002', true);
do $$
begin
  if (select count(*) from public.day_rewards) <> 0 then raise exception 'FAIL: видны чужие награды'; end if;
  if (public.garden_state() ->> 'completed_total')::integer <> 0 then
    raise exception 'FAIL: в сад попали чужие выполнения';
  end if;
  update public.user_settings set reminder_time = '06:00'
    where owner_id = '14000000-0000-0000-0000-000000000001';
end $$;
reset role;
do $$ begin
  if (select reminder_time from public.user_settings
      where owner_id = '14000000-0000-0000-0000-000000000001') <> '08:30'::time then
    raise exception 'FAIL: изменены чужие настройки';
  end if;
end $$;
rollback;
