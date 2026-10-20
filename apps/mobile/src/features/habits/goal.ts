/**
 * Цель привычки, график и время дня (HZ-08). Чистые правила без React — их проверяют тесты.
 * NOTE: Ключи совпадают с допустимыми значениями в базе (habits.goal_unit, time_of_day,
 * habit_schedules.frequency).
 */
export type GoalUnit = 'times' | 'glasses' | 'minutes' | 'pages' | 'steps' | 'km';
export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
export type Frequency = 'days' | 'weekly' | 'interval';

export const GOAL_UNITS: readonly GoalUnit[] = [
  'times',
  'glasses',
  'minutes',
  'pages',
  'steps',
  'km',
];
/** Порядок разделов плана: утро, день, вечер, затем «в любое время». */
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening', 'any'];
export const MAX_GOAL = 100000;

const STEP: Readonly<Record<GoalUnit, number>> = {
  times: 1,
  glasses: 1,
  minutes: 5,
  pages: 5,
  steps: 1000,
  km: 1,
};
const DEFAULT_TARGET: Readonly<Record<GoalUnit, number>> = {
  times: 3,
  glasses: 8,
  minutes: 20,
  pages: 10,
  steps: 10000,
  km: 5,
};

/** Шаг кнопки «+» в плане и стрелок цели в форме: стакан — по одному, шаги — по тысяче. */
export function goalStep(unit: GoalUnit): number {
  return STEP[unit];
}

/** Цель, которую разумно предложить при выборе единицы. */
export function defaultTarget(unit: GoalUnit): number {
  return DEFAULT_TARGET[unit];
}

export function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_GOAL, Math.max(1, Math.round(value)));
}

/** «Просто отметить» — цель 1 раз: такой привычке не нужны счётчик и кнопка «+». */
export function isCountGoal(target: number, unit: GoalUnit): boolean {
  return target > 1 || unit !== 'times';
}

/**
 * Разделы плана по времени дня. Если все привычки «в любое время», раздел один и без
 * заголовка — список выглядит как раньше.
 */
export function groupByTimeOfDay<T extends { readonly timeOfDay: TimeOfDay }>(
  items: readonly T[],
): { readonly key: TimeOfDay; readonly titled: boolean; readonly items: readonly T[] }[] {
  const groups = TIMES_OF_DAY.map((key) => ({
    key,
    items: items.filter((item) => item.timeOfDay === key),
  })).filter((group) => group.items.length > 0);
  const titled = groups.some((group) => group.key !== 'any');
  return groups.map((group) => ({ ...group, titled }));
}

/** «10 000» в русском и украинском, «10,000» в английском — без Intl, которого нет в Hermes. */
export function formatAmount(value: number, language: string): string {
  const separator = language.startsWith('en') ? ',' : '\u00A0';
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

type Translate = (key: string, options: { readonly count: number }) => string;

/** «8 стаканов», «1 страница», «10 000 шагов» — число и слово в нужной форме. */
export function amountText(t: Translate, language: string, amount: number, unit: GoalUnit): string {
  return `${formatAmount(amount, language)} ${t(`habits:unit_word_${unit}`, { count: amount })}`;
}

/** «из 8 стаканов», «из 1 стакана» — после «из» слово стоит в другом падеже. */
export function goalOfText(t: Translate, language: string, target: number, unit: GoalUnit): string {
  return `${formatAmount(target, language)} ${t(`habits:unit_of_${unit}`, { count: target })}`;
}
