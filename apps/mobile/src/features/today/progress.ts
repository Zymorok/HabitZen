import type { PlanItem } from './data/plan-api';

/** Прогресс дня: «Сегодня отдых» не считается ни выполнением, ни долгом. */
export function planProgress(items: readonly PlanItem[]) {
  const counted = items.filter((item) => item.status !== 'skipped');
  const completed = counted.filter((item) => item.status === 'completed').length;
  return {
    completed,
    total: counted.length,
    allDone: counted.length > 0 && completed === counted.length,
  };
}
