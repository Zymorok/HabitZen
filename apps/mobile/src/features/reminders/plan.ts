import { addCalendarDays, localDate, startOfIsoWeek } from '@habitzen/core/calendar';
import type { LocalDate } from '@habitzen/core/calendar';

/**
 * План локальных напоминаний (HZ-R14): что и когда напомнить. Чистое правило без телефона —
 * его проверяют модульные тесты, а platform/notifications только ставит готовый план.
 * NOTE: С HZ-09 «N раз в неделю» и «каждый N-й день» напоминают разовыми уведомлениями
 * на ближайшие дни: повторяющимся по дням недели такой график не выразить.
 */
export interface ReminderHabit {
  readonly id: string;
  readonly title: string;
  /** Биты 0–6 — понедельник…воскресенье. */
  readonly weekdayMask: number;
  /** «ЧЧ:ММ»; пусто — у привычки напоминание выключено. */
  readonly reminderTimes: readonly string[];
  readonly frequency?: 'days' | 'weekly' | 'interval';
  readonly perWeek?: number | null;
  readonly intervalDays?: number | null;
  /** С какого дня действует расписание: от него считается «каждый N-й день». */
  readonly scheduleFrom?: string;
}

/** Что известно о сегодняшнем дне из плана: отмечена ли привычка и сколько раз за неделю. */
export interface ReminderToday {
  readonly date: string;
  /** Минуты от полуночи: прошедшее сегодня время уже не напоминаем. */
  readonly minutes: number;
  readonly doneToday: ReadonlySet<string>;
  /** Сколько раз за неделю выполнена привычка «N раз в неделю» (если она в сегодняшнем плане). */
  readonly weekDone: ReadonlyMap<string, number>;
}

export interface PlannedReminder {
  readonly id: string;
  readonly kind: 'evening' | 'habit';
  readonly title: string;
  readonly hour: number;
  readonly minute: number;
  /** Дни недели по ISO (1 — понедельник … 7 — воскресенье); null — каждый день. */
  readonly weekdays: readonly number[] | null;
  /** Разовые напоминания на эти даты вместо повторяющихся (HZ-09). */
  readonly dates?: readonly string[];
}

/**
 * NOTE: iOS держит не больше 64 запланированных уведомлений на приложение. Берём 60 с запасом:
 * вечернее напоминание идёт первым, затем привычки по порядку списка.
 */
export const MAX_SCHEDULED = 60;
const EVERY_DAY = 0b1111111;
/** На сколько дней вперёд ставить разовые напоминания «каждый N-й день». */
export const INTERVAL_WINDOW_DAYS = 21;

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Сколько системных уведомлений займёт напоминание: ежедневное — одно, по дням — по одному на день. */
export function scheduledCount(reminder: PlannedReminder): number {
  if (reminder.dates) return reminder.dates.length;
  return reminder.weekdays === null ? 1 : reminder.weekdays.length;
}

function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

/**
 * Дни, когда напоминать о привычке с гибким графиком.
 * «N раз в неделю»: до конца этой недели — только пока цель не набрана, и вся следующая неделя
 * (её цель ещё не начата). «Каждый N-й день»: положенные дни на три недели вперёд.
 * Сегодня не напоминаем, если привычка уже отмечена или время прошло.
 */
export function flexibleDates(
  habit: ReminderHabit,
  today: ReminderToday,
  time: { readonly hour: number; readonly minute: number },
): LocalDate[] {
  const start = localDate(today.date);
  const todayAllowed =
    !today.doneToday.has(habit.id) && time.hour * 60 + time.minute > today.minutes;
  const dates: LocalDate[] = [];
  if (habit.frequency === 'weekly') {
    const perWeek = habit.perWeek ?? 1;
    // NOTE: Нет в сегодняшнем плане — значит, цель этой недели уже набрана.
    const done = today.weekDone.get(habit.id) ?? perWeek;
    const nextWeek = addCalendarDays(startOfIsoWeek(start), 7);
    if (done < perWeek) {
      for (let day = start; day < nextWeek; day = addCalendarDays(day, 1)) {
        if (day !== start || todayAllowed) dates.push(day);
      }
    }
    for (let index = 0; index < 7; index += 1) dates.push(addCalendarDays(nextWeek, index));
    return dates;
  }
  if (habit.frequency === 'interval') {
    const every = habit.intervalDays ?? 2;
    const from = localDate(habit.scheduleFrom ?? today.date);
    for (let index = 0; index < INTERVAL_WINDOW_DAYS; index += 1) {
      const day = addCalendarDays(start, index);
      const offset = daysBetween(from, day);
      if (offset < 0 || offset % every !== 0) continue;
      if (day !== start || todayAllowed) dates.push(day);
    }
  }
  return dates;
}

export function buildReminderPlan(input: {
  readonly enabled: boolean;
  readonly eveningTime: string;
  readonly habits: readonly ReminderHabit[];
  /** Без сведений о сегодняшнем дне гибкие графики не напоминают — нечем проверить цель. */
  readonly today?: ReminderToday;
}): PlannedReminder[] {
  if (!input.enabled) return [];
  const plan: PlannedReminder[] = [];
  let used = 0;
  const add = (reminder: PlannedReminder) => {
    const cost = scheduledCount(reminder);
    if (cost === 0 || used + cost > MAX_SCHEDULED) return;
    plan.push(reminder);
    used += cost;
  };
  const evening = parseTime(input.eveningTime);
  if (evening) add({ id: 'evening', kind: 'evening', title: '', ...evening, weekdays: null });
  for (const habit of input.habits) {
    if (habit.frequency === 'weekly' || habit.frequency === 'interval') {
      const today = input.today;
      if (!today) continue;
      habit.reminderTimes.forEach((value, index) => {
        const time = parseTime(value);
        if (!time) return;
        add({
          id: `${habit.id}-${index}`,
          kind: 'habit',
          title: habit.title,
          ...time,
          weekdays: null,
          dates: flexibleDates(habit, today, time),
        });
      });
      continue;
    }
    const mask = habit.weekdayMask & EVERY_DAY;
    const weekdays =
      mask === EVERY_DAY
        ? null
        : Array.from({ length: 7 }, (_, bit) => bit).flatMap((bit) =>
            mask & (1 << bit) ? [bit + 1] : [],
          );
    habit.reminderTimes.forEach((value, index) => {
      const time = parseTime(value);
      if (time)
        add({ id: `${habit.id}-${index}`, kind: 'habit', title: habit.title, ...time, weekdays });
    });
  }
  return plan;
}
