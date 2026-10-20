import { describe, expect, it } from 'vitest';
import {
  buildReminderPlan,
  flexibleDates,
  MAX_SCHEDULED,
  scheduledCount,
} from '../../apps/mobile/src/features/reminders/plan';
import type { ReminderToday } from '../../apps/mobile/src/features/reminders/plan';

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

/** HZ-09: «N раз в неделю» и «каждый N-й день» — разовые напоминания на ближайшие дни. */
describe('Напоминания гибкого графика', () => {
  // NOTE: 20 октября 2026 — вторник, 10:00.
  const today = (patch: Partial<ReminderToday> = {}): ReminderToday => ({
    date: '2026-10-20',
    minutes: 600,
    doneToday: new Set(),
    weekDone: new Map([['pool', 1]]),
    ...patch,
  });
  const pool = {
    id: 'pool',
    title: 'Бассейн',
    weekdayMask: 127,
    reminderTimes: ['19:00'],
    frequency: 'weekly' as const,
    perWeek: 3,
  };
  const flowers = {
    id: 'flowers',
    title: 'Полить цветы',
    weekdayMask: 127,
    reminderTimes: ['09:00'],
    frequency: 'interval' as const,
    intervalDays: 3,
    scheduleFrom: '2026-10-18',
  };
  const at19 = { hour: 19, minute: 0 };

  it('недельная цель не набрана — до воскресенья и вся следующая неделя', () => {
    const dates = flexibleDates(pool, today(), at19);
    expect(dates.slice(0, 6)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(dates).toHaveLength(13);
    expect(dates.at(-1)).toBe('2026-11-01');
  });
  it('отмечена сегодня — со завтрашнего дня; цель набрана — только следующая неделя', () => {
    expect(flexibleDates(pool, today({ doneToday: new Set(['pool']) }), at19)[0]).toBe(
      '2026-10-21',
    );
    const done = flexibleDates(pool, today({ weekDone: new Map() }), at19);
    expect(done[0]).toBe('2026-10-26');
    expect(done).toHaveLength(7);
  });
  it('прошедшее сегодня время не ставится', () => {
    expect(flexibleDates(pool, today({ minutes: 20 * 60 }), at19)[0]).toBe('2026-10-21');
  });
  it('«каждый 3-й день» — только положенные дни на три недели вперёд', () => {
    expect(flexibleDates(flowers, today(), { hour: 9, minute: 0 })).toEqual([
      '2026-10-21',
      '2026-10-24',
      '2026-10-27',
      '2026-10-30',
      '2026-11-02',
      '2026-11-05',
      '2026-11-08',
    ]);
    const fromToday = { ...flowers, scheduleFrom: '2026-10-20' };
    expect(flexibleDates(fromToday, today(), { hour: 11, minute: 0 })[0]).toBe('2026-10-20');
    expect(flexibleDates(fromToday, today(), { hour: 9, minute: 0 })[0]).toBe('2026-10-23');
  });
  it('без сведений о сегодняшнем дне гибкие графики не напоминают', () => {
    const plan = buildReminderPlan({ enabled: true, eveningTime: '', habits: [pool, flowers] });
    expect(plan).toEqual([]);
    const withToday = buildReminderPlan({
      enabled: true,
      eveningTime: '',
      habits: [pool, flowers],
      today: today(),
    });
    expect(withToday.map((item) => [item.id, scheduledCount(item)])).toEqual([
      ['pool-0', 13],
      ['flowers-0', 7],
    ]);
  });
});
