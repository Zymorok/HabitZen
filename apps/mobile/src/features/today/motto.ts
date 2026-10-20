/**
 * Подсказка под кольцом дня (HZ-10): с чего начать, сколько осталось, всё ли сделано.
 * Чистое правило — проверяется тестами; текст берётся из словаря habits.
 */
export function dayMotto(
  completed: number,
  total: number,
): { readonly key: string; readonly options?: { readonly count: number } } {
  if (total === 0) return { key: 'motto_optional' };
  if (completed >= total) return { key: 'day_complete' };
  if (completed === 0) return { key: 'motto_start' };
  return { key: 'motto_left', options: { count: total - completed } };
}
