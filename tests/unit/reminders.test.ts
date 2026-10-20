import { describe, expect, it } from 'vitest';
import {
  buildReminderPlan,
  MAX_SCHEDULED,
  scheduledCount,
} from '../../apps/mobile/src/features/reminders/plan';

/** HZ-06: план локальных напоминаний (кадр 12 и форма привычки). */
const habit = (id: string, weekdayMask: number, reminderTimes: string[]) => ({
  id,
  title: `Привычка ${id}`,
  weekdayMask,
  reminderTimes,
});

describe('Напоминания', () => {
  it('выключенные напоминания ничего не ставят', () => {
    expect(
      buildReminderPlan({
        enabled: false,
        eveningTime: '21:00',
        habits: [habit('a', 127, ['08:00'])],
      }),
    ).toEqual([]);
  });
  it('вечернее напоминание каждый день и привычки по своим дням', () => {
    const plan = buildReminderPlan({
      enabled: true,
      eveningTime: '21:00:00',
      habits: [habit('a', 127, ['08:30']), habit('b', 0b0010101, ['19:15']), habit('c', 127, [])],
    });
    expect(plan.map((item) => item.id)).toEqual(['evening', 'a-0', 'b-0']);
    expect(plan[0]).toMatchObject({ kind: 'evening', hour: 21, minute: 0, weekdays: null });
    expect(plan[1]).toMatchObject({ kind: 'habit', hour: 8, minute: 30, weekdays: null });
    // NOTE: Биты 0, 2, 4 — понедельник, среда, пятница.
    expect(plan[2]?.weekdays).toEqual([1, 3, 5]);
  });
  it('неверное время пропускается, а не ломает план', () => {
    const plan = buildReminderPlan({
      enabled: true,
      eveningTime: 'вечером',
      habits: [habit('a', 127, ['25:00', '07:05'])],
    });
    expect(plan.map((item) => item.id)).toEqual(['a-1']);
  });
  it('не превышает предел системных уведомлений', () => {
    const habits = Array.from({ length: 20 }, (_, index) =>
      habit(String(index), 0b0111111, ['09:00']),
    );
    const plan = buildReminderPlan({ enabled: true, eveningTime: '21:00', habits });
    const total = plan.reduce((sum, item) => sum + scheduledCount(item), 0);
    expect(total).toBeLessThanOrEqual(MAX_SCHEDULED);
    expect(plan[0]?.id).toBe('evening');
  });
});
