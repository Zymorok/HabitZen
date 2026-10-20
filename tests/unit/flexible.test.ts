import { describe, expect, it } from 'vitest';
import { localDate } from '../../packages/core/src/calendar.ts';
import {
  clampGoal,
  defaultTarget,
  formatAmount,
  goalStep,
  groupByTimeOfDay,
  isCountGoal,
} from '../../apps/mobile/src/features/habits/goal';
import { applyProgress, planProgress } from '../../apps/mobile/src/features/today/progress';
import {
  moveItem,
  orderOf,
  positionsOf,
  slotAt,
} from '../../apps/mobile/src/features/habits/order';
import type { PlanItem } from '../../apps/mobile/src/features/today/data/plan-api';
import {
  bestDay,
  habitDayShare,
  habitWeekLine,
  weekDelta,
  yearGrid,
} from '../../apps/mobile/src/features/progress/stats';
import type { CalendarDay } from '../../apps/mobile/src/features/progress/data/progress-api';

/** HZ-08: цель с количеством, гибкий график, итоги недели и годовая карта. */

const plan = (patch: Partial<PlanItem>): PlanItem => ({
  itemId: Math.random().toString(36),
  habitId: 'h',
  title: 'Вода',
  iconKey: 'drop',
  colorKey: 'blue',
  status: 'pending',
  revision: 1,
  localDate: '2026-10-20',
  target: 8,
  progress: 0,
  goalUnit: 'glasses',
  timeOfDay: 'any',
  flexible: false,
  weekDone: 0,
  perWeek: null,
  ...patch,
});

describe('цель привычки', () => {
  it('шаг и цель по умолчанию зависят от единицы', () => {
    expect(goalStep('glasses')).toBe(1);
    expect(goalStep('steps')).toBe(1000);
    expect(defaultTarget('glasses')).toBe(8);
    expect(defaultTarget('minutes')).toBe(20);
  });
  it('цель не выходит за пределы 1…100 000 и всегда целая', () => {
    expect(clampGoal(0)).toBe(1);
    expect(clampGoal(2.6)).toBe(3);
    expect(clampGoal(10 ** 7)).toBe(100000);
    expect(clampGoal(Number.NaN)).toBe(1);
  });
  it('«просто отметить» — это 1 раз; остальное — счётчик', () => {
    expect(isCountGoal(1, 'times')).toBe(false);
    expect(isCountGoal(3, 'times')).toBe(true);
    expect(isCountGoal(1, 'km')).toBe(true);
  });
  it('пишет большие числа с разделителем', () => {
    expect(formatAmount(10000, 'ru')).toBe('10 000');
    expect(formatAmount(10000, 'en')).toBe('10,000');
    expect(formatAmount(950, 'uk')).toBe('950');
  });
});

describe('«+1» в плане дня', () => {
  it('набирает цель и отмечает привычку, когда цель набрана', () => {
    const item = plan({ progress: 7 });
    expect(applyProgress(item, 1)).toMatchObject({ progress: 8, status: 'completed' });
    expect(applyProgress(plan({ progress: 8, status: 'completed' }), -1)).toMatchObject({
      progress: 7,
      status: 'pending',
    });
  });
  it('не уходит ниже нуля и выше десятикратной цели', () => {
    expect(applyProgress(plan({}), -3).progress).toBe(0);
    expect(applyProgress(plan({ progress: 79 }), 5).progress).toBe(80);
  });
  it('недельная привычка сразу видит своё «2 из 3»', () => {
    const weekly = plan({ target: 1, goalUnit: 'times', flexible: true, weekDone: 1, perWeek: 3 });
    expect(applyProgress(weekly, 1).weekDone).toBe(2);
    expect(applyProgress(applyProgress(weekly, 1), -1).weekDone).toBe(1);
  });
  it('невыполненная «N раз в неделю» не входит в счёт дня', () => {
    const daily = plan({ target: 1, goalUnit: 'times' });
    const weekly = plan({ target: 1, goalUnit: 'times', flexible: true });
    expect(planProgress([daily, weekly])).toEqual({ completed: 0, total: 1, allDone: false });
    expect(planProgress([daily, { ...weekly, status: 'completed' }])).toEqual({
      completed: 1,
      total: 2,
      allDone: false,
    });
  });
});

describe('разделы «Утро / День / Вечер»', () => {
  it('идут по порядку дня и без заголовков, если всё «в любое время»', () => {
    const groups = groupByTimeOfDay([
      plan({ timeOfDay: 'evening', title: 'Чтение' }),
      plan({ timeOfDay: 'morning', title: 'Вода' }),
      plan({ timeOfDay: 'any', title: 'Прогулка' }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(['morning', 'evening', 'any']);
    expect(groups.every((group) => group.titled)).toBe(true);
    const plain = groupByTimeOfDay([plan({}), plan({})]);
    expect(plain).toHaveLength(1);
    expect(plain[0]?.titled).toBe(false);
  });
});

const day = (date: string, completed: number, planned = 2): CalendarDay => ({
  date,
  planned,
  completed,
  skipped: 0,
  outcome: completed >= planned ? 'completed' : 'missed',
});

describe('итоги недели', () => {
  it('сравнивает с прошлой неделей в процентах', () => {
    expect(weekDelta(0.8, 0.5)).toBe(30);
    expect(weekDelta(0.5, 0.75)).toBe(-25);
    expect(weekDelta(0.5, null)).toBeNull();
  });
  it('лучший день — с наибольшей долей, при равенстве более ранний', () => {
    const bars = [
      { date: localDate('2026-10-12'), share: 0.5, future: false },
      { date: localDate('2026-10-13'), share: 1, future: false },
      { date: localDate('2026-10-14'), share: 1, future: false },
      { date: localDate('2026-10-15'), share: null, future: false },
    ];
    expect(bestDay(bars)).toBe('2026-10-13');
    expect(bestDay([{ date: localDate('2026-10-12'), share: 0, future: false }])).toBeNull();
  });
  it('«N раз в неделю» считается от недельной цели', () => {
    expect(habitWeekLine({ planned: 4, completed: 2, perWeek: 3 })).toEqual({
      done: 2,
      total: 3,
      share: 2 / 3,
    });
    expect(habitWeekLine({ planned: 0, completed: 0, perWeek: null }).share).toBe(0);
  });
});

describe('годовая карта', () => {
  it('53 недели с понедельника, будущее пустое, подписи месяцев на их первой неделе', () => {
    const today = localDate('2026-10-20');
    const grid = yearGrid(
      [day('2026-10-19', 2), day('2026-10-20', 1), day('2026-10-01', 0)],
      today,
    );
    expect(grid.columns).toHaveLength(53);
    const last = grid.columns.at(-1)!;
    expect(last[0]).toEqual({ date: '2026-10-19', intensity: 4 });
    expect(last[1]).toEqual({ date: '2026-10-20', intensity: 2 });
    expect(last[2]?.intensity).toBeNull();
    expect(grid.activeDays).toBe(2);
    const october = grid.months.find((month) => month.month === '2026-10-01');
    expect(grid.columns[october!.column]!.some((cell) => cell.date === '2026-10-01')).toBe(true);
  });
});

describe('частичный день в статистике привычки (HZ-09)', () => {
  const day = (
    status: 'completed' | 'pending' | 'missed' | 'rest',
    progress: number,
    target = 8,
  ) => ({
    date: '2026-10-20',
    status,
    progress,
    target,
  });
  it('доля цели — для набранного не до конца дня', () => {
    expect(habitDayShare(day('missed', 5))).toBe(5 / 8);
    expect(habitDayShare(day('pending', 0))).toBe(0);
    expect(habitDayShare(day('completed', 8))).toBe(1);
    // NOTE: Перевыполнение без отметки не превращается в «выполнено» — доля меньше единицы.
    expect(habitDayShare(day('missed', 12))).toBeLessThan(1);
    expect(habitDayShare(day('rest', 3))).toBe(0);
  });
});

describe('порядок привычек перетаскиванием (HZ-09)', () => {
  it('строка переезжает, остальные сдвигаются на одну позицию', () => {
    const start = positionsOf(['a', 'b', 'c', 'd']);
    expect(orderOf(moveItem(start, 3, 0))).toEqual(['d', 'a', 'b', 'c']);
    expect(orderOf(moveItem(start, 0, 2))).toEqual(['b', 'c', 'a', 'd']);
    expect(orderOf(moveItem(start, 1, 1))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('место по смещению пальца не выходит за края списка', () => {
    expect(slotAt(-50, 68, 4)).toBe(0);
    expect(slotAt(100, 68, 4)).toBe(1);
    expect(slotAt(1000, 68, 4)).toBe(3);
  });
});
