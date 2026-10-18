import { describe, expect, it } from 'vitest';
import { localDate } from '../../packages/core/src/calendar.ts';
import {
  dayIntensity,
  dayShare,
  habitStreak,
  habitWeek,
  totalCompleted,
  weekSummary,
} from '../../apps/mobile/src/features/progress/stats';
import type {
  CalendarDay,
  HabitDay,
} from '../../apps/mobile/src/features/progress/data/progress-api';

/** HZ-05: правила календаря (кадр 08) и истории привычки (кадр 09). */
const day = (date: string, planned: number, completed: number, skipped = 0): CalendarDay => ({
  date,
  planned,
  completed,
  skipped,
  outcome: planned === 0 ? 'rest' : completed === planned ? 'completed' : 'missed',
});

describe('Календарь: насыщенность дней', () => {
  it('«Сегодня отдых» не считается долгом', () => {
    expect(dayShare(day('2026-10-17', 5, 4, 1))).toBe(1);
    expect(dayShare(day('2026-10-17', 5, 2))).toBe(0.4);
  });
  it('свободный день и день без истории не окрашиваются', () => {
    expect(dayShare(day('2026-10-18', 0, 0))).toBeNull();
    expect(dayShare(day('2026-10-18', 2, 0, 2))).toBeNull();
    expect(dayShare(undefined)).toBeNull();
    expect(dayIntensity(null)).toBe(0);
  });
  it('цвет густеет вместе с долей выполненного', () => {
    expect([0, 0.2, 0.4, 0.8, 1].map(dayIntensity)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('Неделя и итоги месяца', () => {
  const days = [
    day('2026-10-12', 5, 5),
    day('2026-10-13', 5, 3),
    day('2026-10-14', 4, 4, 1),
    day('2026-10-15', 5, 0),
    day('2026-10-16', 0, 0),
  ];
  it('процент недели считает только прошедшие дни и без отдыха', () => {
    const week = weekSummary(days, localDate('2026-10-12'), localDate('2026-10-14'));
    expect(week.bars).toHaveLength(7);
    expect(week.bars[3]?.future).toBe(true);
    expect(week.percent).toBeCloseTo(12 / 13);
  });
  it('неделя без запланированного не показывает 0%', () => {
    expect(weekSummary([], localDate('2026-10-19'), localDate('2026-10-19')).percent).toBeNull();
  });
  it('выполнения считаются только внутри месяца', () => {
    expect(totalCompleted(days, '2026-10-13', '2026-10-31')).toBe(7);
  });
});

describe('История привычки', () => {
  const history = (statuses: HabitDay['status'][]): HabitDay[] =>
    statuses.map((status, index) => ({
      date: `2026-10-${String(10 + index).padStart(2, '0')}`,
      status,
    }));
  it('несделанная сегодняшняя привычка не обрывает серию', () => {
    expect(habitStreak(history(['completed', 'rest', 'completed', 'pending']))).toEqual({
      current: 2,
      best: 2,
    });
  });
  it('пропуск и «отдых» обрывают серию привычки, лучший результат сохраняется', () => {
    expect(
      habitStreak(history(['completed', 'completed', 'completed', 'missed', 'completed'])),
    ).toEqual({ current: 1, best: 3 });
    expect(habitStreak(history(['completed', 'skipped', 'completed']))).toEqual({
      current: 1,
      best: 1,
    });
    expect(habitStreak([])).toEqual({ current: 0, best: 0 });
  });
  it('«5/7»: выполнено из запланированных в неделе дней', () => {
    const week = habitWeek(
      history(['completed', 'missed', 'completed', 'rest', 'pending']),
      localDate('2026-10-12'),
      localDate('2026-10-14'),
    );
    expect(week.done).toBe(1);
    expect(week.planned).toBe(2);
    expect(week.marks[3]?.future).toBe(true);
  });
});
