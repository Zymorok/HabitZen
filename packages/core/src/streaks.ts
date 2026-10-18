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
