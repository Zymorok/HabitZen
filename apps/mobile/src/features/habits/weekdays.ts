/**
 * Дни недели в маске расписания: бит 0 — понедельник, бит 6 — воскресенье.
 * Чистые функции, чтобы проверять их тестами без React.
 */
export const ALL_WEEKDAYS = 0b1111111;

export function toggleWeekday(mask: number, day: number): number {
  return mask ^ (1 << day);
}

export function hasWeekday(mask: number, day: number): boolean {
  return (mask & (1 << day)) !== 0;
}

/** «Каждый день» или короткий список выбранных дней в порядке недели. */
export function describeWeekdays(
  mask: number,
  shortNames: readonly string[],
  everyDay: string,
): string {
  if ((mask & ALL_WEEKDAYS) === ALL_WEEKDAYS) return everyDay;
  return shortNames.filter((_, day) => hasWeekday(mask, day)).join(', ');
}
