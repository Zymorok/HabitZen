import { addCalendarDays, localDate, startOfIsoWeek } from '@habitzen/core/calendar';
import type { LocalDate } from '@habitzen/core/calendar';
import { summarizeStreaks } from '@habitzen/core/streaks';
import type { CalendarDay, HabitDay, HabitDayStatus } from './data/progress-api';

/**
 * Правила экранов прогресса (кадры 08–09) без React и сервера — их проверяют модульные тесты.
 * NOTE: «Сегодня отдых» не считается долгом в долях и процентах — как в «3 из 5» на кадре 02.
 */
export function dayShare(day: CalendarDay | undefined): number | null {
  if (!day) return null;
  const due = day.planned - day.skipped;
  return due > 0 ? Math.min(1, day.completed / due) : null;
}

/** Насыщенность кружка дня: 0 — ничего не сделано, 4 — сделано всё. */
export function dayIntensity(share: number | null): 0 | 1 | 2 | 3 | 4 {
  if (share === null || share <= 0) return 0;
  if (share >= 1) return 4;
  if (share >= 0.66) return 3;
  return share >= 0.33 ? 2 : 1;
}

export interface WeekBar {
  readonly date: LocalDate;
  readonly share: number | null;
  readonly future: boolean;
}

/** Неделя с понедельника: столбцы и доля выполненного за прошедшие дни недели. */
export function weekSummary(
  days: readonly CalendarDay[],
  weekStart: LocalDate,
  today: LocalDate,
): { readonly bars: readonly WeekBar[]; readonly percent: number | null } {
  const byDate = new Map(days.map((day) => [day.date, day]));
  let done = 0;
  let due = 0;
  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStart, index);
    const day = byDate.get(date);
    if (day && date <= today) {
      done += day.completed;
      due += day.planned - day.skipped;
    }
    return { date, share: dayShare(day), future: date > today };
  });
  return { bars, percent: due > 0 ? Math.min(1, done / due) : null };
}

/** Сколько отметок «выполнено» за период (для «24 выполнения» за месяц). */
export function totalCompleted(days: readonly CalendarDay[], from: string, to: string): number {
  return days
    .filter((day) => day.date >= from && day.date <= to)
    .reduce((sum, day) => sum + day.completed, 0);
}

/** Серия одной привычки: пропуск и «отдых» обрывают её, незапланированный день нейтрален. */
export function habitStreak(days: readonly HabitDay[]): { current: number; best: number } {
  const sorted = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const last = sorted.at(-1);
  if (!last) return { current: 0, best: 0 };
  return summarizeStreaks(
    sorted.map((day) => ({
      date: localDate(day.date),
      outcome: day.status === 'completed' ? 'completed' : day.status === 'rest' ? 'rest' : 'missed',
    })),
    // NOTE: Сегодняшняя ещё не сделанная привычка не обрывает серию — так считает ядро.
    localDate(last.date),
  );
}

export interface HabitWeekMark {
  readonly date: LocalDate;
  readonly status: HabitDayStatus | null;
  readonly future: boolean;
}

/** «5/7» на кадре 09: выполнено за неделю из запланированных до сегодняшнего дня включительно. */
export function habitWeek(
  days: readonly HabitDay[],
  weekStart: LocalDate,
  today: LocalDate,
): { readonly done: number; readonly planned: number; readonly marks: readonly HabitWeekMark[] } {
  const byDate = new Map(days.map((day) => [day.date, day.status]));
  let done = 0;
  let planned = 0;
  const marks = Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStart, index);
    const status = byDate.get(date) ?? null;
    if (status === 'completed') done += 1;
    if (status && status !== 'rest') planned += 1;
    return { date, status, future: date > today };
  });
  return { done, planned, marks };
}

/** «+12 %» к прошлой неделе — разница долей в процентах; null, если сравнивать не с чем. */
export function weekDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 100);
}

/** Лучший день недели — с наибольшей долей выполненного; при равенстве — более ранний. */
export function bestDay(bars: readonly WeekBar[]): LocalDate | null {
  let best: WeekBar | null = null;
  for (const bar of bars) {
    if (bar.future || bar.share === null || bar.share <= 0) continue;
    if (!best || (best.share ?? 0) < bar.share) best = bar;
  }
  return best?.date ?? null;
}

/**
 * Строка привычки в «Итогах недели»: «5 из 7» по дням или «2 из 3» для «N раз в неделю».
 * NOTE: Недельная цель — знаменатель сразу, даже если неделя ещё идёт.
 */
export function habitWeekLine(habit: {
  readonly planned: number;
  readonly completed: number;
  readonly perWeek: number | null;
}): { readonly done: number; readonly total: number; readonly share: number } {
  const total = habit.perWeek ?? habit.planned;
  return {
    done: habit.completed,
    total,
    share: total > 0 ? Math.min(1, habit.completed / total) : 0,
  };
}

export interface YearCell {
  readonly date: LocalDate;
  /** 0…4 — насыщенность дня; null — будущее или день без истории. */
  readonly intensity: 0 | 1 | 2 | 3 | 4 | null;
}

/**
 * Годовая карта: 53 недели столбцами с понедельника, последняя — текущая.
 * Подписи месяцев ставятся над неделей, в которой месяц начинается.
 */
export function yearGrid(
  days: readonly CalendarDay[],
  today: LocalDate,
  weeks = 53,
): {
  readonly columns: readonly (readonly YearCell[])[];
  readonly months: readonly { readonly column: number; readonly month: LocalDate }[];
  readonly activeDays: number;
} {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = addCalendarDays(startOfIsoWeek(today), -(weeks - 1) * 7);
  const months: { column: number; month: LocalDate }[] = [];
  let activeDays = 0;
  const columns = Array.from({ length: weeks }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => {
      const date = addCalendarDays(first, column * 7 + row);
      // NOTE: Первую неделю не подписываем, если месяц начался раньше неё — подпись обрежется.
      if (date.endsWith('-01') && date <= today) months.push({ column, month: date });
      const day = date <= today ? byDate.get(date) : undefined;
      if (day && day.completed > 0) activeDays += 1;
      return { date, intensity: day ? dayIntensity(dayShare(day)) : null };
    }),
  );
  return { columns, months, activeDays };
}

/**
 * Доля цели за день у одной привычки (HZ-09): выполнено — 1, «5 из 8» — 0,625, иначе 0.
 * NOTE: Частичный день не считается выполненным для серии и «5/7» — только показывается.
 */
export function habitDayShare(day: HabitDay): number {
  if (day.status === 'completed') return 1;
  if (day.status === 'rest' || day.progress <= 0 || day.target <= 0) return 0;
  return Math.min(0.99, day.progress / day.target);
}
