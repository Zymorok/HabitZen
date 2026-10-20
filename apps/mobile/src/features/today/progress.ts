import type { PlanItem } from './data/plan-api';

/**
 * Прогресс дня: «Сегодня отдых» не считается ни выполнением, ни долгом.
 * NOTE: Привычка «N раз в неделю» в любой день необязательна: она попадает в счёт дня,
 * только когда её выполнили, — так же считает сервер (calendar_days, claim_day_reward).
 */
export function planProgress(items: readonly PlanItem[]) {
  const counted = items.filter(
    (item) => item.status !== 'skipped' && !(item.flexible && item.status !== 'completed'),
  );
  const completed = counted.filter((item) => item.status === 'completed').length;
  return {
    completed,
    total: counted.length,
    allDone: counted.length > 0 && completed === counted.length,
  };
}

/**
 * Что покажет строка сразу после «+1», ещё до ответа сервера. Правила те же, что
 * в add_plan_progress: не меньше нуля, не больше десятикратной цели, цель набрана — выполнено.
 */
export function applyProgress(item: PlanItem, delta: number): PlanItem {
  const progress = Math.max(0, Math.min(item.progress + delta, item.target * 10));
  const status = progress >= item.target ? 'completed' : 'pending';
  const weekShift =
    item.flexible && status !== item.status
      ? status === 'completed'
        ? 1
        : item.status === 'completed'
          ? -1
          : 0
      : 0;
  return { ...item, progress, status, weekDone: item.weekDone + weekShift };
}
