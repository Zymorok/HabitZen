-- NOTE: HZ-07. Старые квитанции повторов удаляются, свежие и чужие остаются.
begin;
insert into auth.users values
  ('15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002');
insert into public.mutation_receipts(owner_id, request_id, operation, payload_digest, result, created_at) values
  ('15000000-0000-0000-0000-000000000001', 'eeee0000-0000-0000-0000-000000000001', 'habit.create',
   repeat('a', 64), '{"old": true}', now() - interval '40 days'),
  ('15000000-0000-0000-0000-000000000001', 'eeee0000-0000-0000-0000-000000000002', 'habit.create',
   repeat('b', 64), '{"recent": true}', now() - interval '5 days'),
  ('15000000-0000-0000-0000-000000000002', 'eeee0000-0000-0000-0000-000000000003', 'habit.create',
   repeat('c', 64), '{"other": true}', now() - interval '40 days');

set local role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', true);
select public.create_habit('eeee0000-0000-0000-0000-000000000004', 'Вода', 'water', 'drop', 'blue', 127::smallint);
reset role;
do $$ begin
  if exists (select 1 from public.mutation_receipts where request_id = 'eeee0000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: старая квитанция не удалена';
  end if;
  if not exists (select 1 from public.mutation_receipts where request_id = 'eeee0000-0000-0000-0000-000000000002') then
    raise exception 'FAIL: удалена свежая квитанция';
  end if;
  if not exists (select 1 from public.mutation_receipts where request_id = 'eeee0000-0000-0000-0000-000000000003') then
    raise exception 'FAIL: удалена квитанция другого аккаунта';
  end if;
  if not exists (select 1 from public.mutation_receipts where request_id = 'eeee0000-0000-0000-0000-000000000004') then
    raise exception 'FAIL: новая квитанция не сохранена';
  end if;
end $$;
rollback;
