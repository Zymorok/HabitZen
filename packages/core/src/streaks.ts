import { addCalendarDays } from './calendar.ts';
import type { LocalDate } from './calendar.ts';

export type DayOutcome = 'completed' | 'missed' | 'rest';
export interface ScheduledDay {
  readonly date: LocalDate;
  readonly outcome: DayOutcome;
}
export interface StreakSummary {
  readonly current: number;
  readonly best: number;
}

export function summarizeStreaks(days: readonly ScheduledDay[], today: LocalDate): StreakSummary {
  // NOTE: Незапланированные дни нейтральны; пропуск запланированного дня обрывает серию.
  const seen = new Set<LocalDate>();
  const sorted = [...days].sort((left, right) => left.date.localeCompare(right.date));
  let current = 0;
  let best = 0;
  let previous: LocalDate | undefined;
  for (const day of sorted) {
    if (seen.has(day.date)) throw new RangeError('День в истории не должен повторяться.');
    seen.add(day.date);
    if (day.date > today) continue;
    // NOTE: На входе нужен полный календарь с выходными и пропусками, а не только успешные отметки.
    if (previous && day.date !== addCalendarDays(previous, 1)) {
      throw new RangeError('В календаре отсутствует день; серию нельзя рассчитать достоверно.');
    }
    previous = day.date;
    if (day.outcome === 'completed') {
      current += 1;
      best = Math.max(best, current);
    } else if (day.outcome === 'missed' && day.date < today) {
      current = 0;
    }
  }
  if (previous && previous < addCalendarDays(today, -1)) {
    throw new RangeError('История не доведена до вчерашнего дня.');
  }
  return { current, best };
}

/** Каждые семь выполненных дней дают одну заморозку серии; в запасе не больше двух. */
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

export interface FreezeSummary extends StreakSummary {
  /** Заморозки в запасе. */
  readonly freezes: number;
  /** Сколько выполненных дней до следующей заморозки; 0 — запас полон. */
  readonly nextFreezeIn: number;
  /** Пропуски, которые закрыла заморозка: серия на них не оборвалась. */
  readonly frozen: readonly LocalDate[];
}

/**
 * Серия с заморозками (HZ-08). Заморозка сама закрывает пропущенный день: серия не растёт,
 * но и не обрывается. Запас считается по той же истории, поэтому серверу не нужно его хранить.
 * NOTE: Заморозка тратится, только если есть что спасать, — на пропуск без серии она не уходит.
 */
export function summarizeWithFreezes(
  days: readonly ScheduledDay[],
  today: LocalDate,
): FreezeSummary {
  // NOTE: Те же проверки полноты истории, что и у обычной серии.
  summarizeStreaks(days, today);
  const sorted = [...days]
    .filter((day) => day.date <= today)
    .sort((left, right) => left.date.localeCompare(right.date));
  let current = 0;
  let best = 0;
  let freezes = 0;
  let earned = 0;
  const frozen: LocalDate[] = [];
  for (const day of sorted) {
    if (day.outcome === 'completed') {
      current += 1;
      best = Math.max(best, current);
      if (freezes < MAX_FREEZES) {
        earned += 1;
        if (earned === FREEZE_EVERY) {
          freezes += 1;
          earned = 0;
        }
      }
    } else if (day.outcome === 'missed' && day.date < today) {
      if (freezes > 0 && current > 0) {
        freezes -= 1;
        frozen.push(day.date);
      } else {
        current = 0;
      }
    }
  }
  return {
    current,
    best,
    freezes,
    nextFreezeIn: freezes >= MAX_FREEZES ? 0 : FREEZE_EVERY - earned,
    frozen,
  };
}
