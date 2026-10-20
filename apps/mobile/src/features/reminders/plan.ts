/**
 * План локальных напоминаний (HZ-R14): что и когда напомнить. Чистое правило без телефона —
 * его проверяют модульные тесты, а platform/notifications только ставит готовый план.
 */
export interface ReminderHabit {
  readonly id: string;
  readonly title: string;
  /** Биты 0–6 — понедельник…воскресенье. */
  readonly weekdayMask: number;
  /** «ЧЧ:ММ»; пусто — у привычки напоминание выключено. */
  readonly reminderTimes: readonly string[];
}

export interface PlannedReminder {
  readonly id: string;
  readonly kind: 'evening' | 'habit';
  readonly title: string;
  readonly hour: number;
  readonly minute: number;
  /** Дни недели по ISO (1 — понедельник … 7 — воскресенье); null — каждый день. */
  readonly weekdays: readonly number[] | null;
}

/**
 * NOTE: iOS держит не больше 64 запланированных уведомлений на приложение. Берём 60 с запасом:
 * вечернее напоминание идёт первым, затем привычки по порядку списка.
 */
export const MAX_SCHEDULED = 60;
const EVERY_DAY = 0b1111111;

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Сколько системных уведомлений займёт напоминание: ежедневное — одно, по дням — по одному на день. */
export function scheduledCount(reminder: PlannedReminder): number {
  return reminder.weekdays === null ? 1 : reminder.weekdays.length;
}

export function buildReminderPlan(input: {
  readonly enabled: boolean;
  readonly eveningTime: string;
  readonly habits: readonly ReminderHabit[];
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
