import { addCalendarDays, localDate } from '@habitzen/core/calendar';
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
