-- NOTE: HZ-07. Квитанции повторных запросов (mutation_receipts) хранятся 30 дней.
-- Этого с запасом хватает, чтобы повтор после обрыва сети не удвоил действие, а таблица
-- не растёт бесконечно. Очистка идёт по ходу: каждая новая квитанция убирает старые
-- квитанции того же владельца — без отдельной плановой задачи и без чужих данных.
begin;

create index mutation_receipts_owner_created on public.mutation_receipts(owner_id, created_at);

create or replace function public.receipt_store(
  p_owner uuid, p_request_id uuid, p_operation text, p_digest text, p_result jsonb
) returns jsonb language sql security definer set search_path = '' as $$
  delete from public.mutation_receipts
    where owner_id = p_owner and created_at < statement_timestamp() - interval '30 days';
  insert into public.mutation_receipts(owner_id, request_id, operation, payload_digest, result)
  values (p_owner, p_request_id, p_operation, p_digest, p_result);
  select p_result;
$$;
revoke all on function public.receipt_store(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
commit;
