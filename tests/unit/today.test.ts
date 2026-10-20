import { describe, expect, it } from 'vitest';
import { greetingKey, isDaytime } from '../../apps/mobile/src/features/today/greeting';
import { planProgress } from '../../apps/mobile/src/features/today/progress';
import { shiftTime } from '../../apps/mobile/src/features/habits/time';
import { flameColor } from '../../apps/mobile/src/features/today/streak-look';
import type { PlanItem } from '../../apps/mobile/src/features/today/data/plan-api';

const item = (status: PlanItem['status']): PlanItem => ({
  itemId: status + Math.random(),
  habitId: 'h',
  title: 'Привычка',
  iconKey: 'book',
  colorKey: 'sage',
  status,
  revision: 1,
  localDate: '2026-10-18',
  target: 1,
  progress: status === 'completed' ? 1 : 0,
  goalUnit: 'times',
  timeOfDay: 'any',
  flexible: false,
  weekDone: 0,
  perWeek: null,
});

describe('кадр 02: приветствие и прогресс дня', () => {
  it('здоровается по времени суток', () => {
    expect(greetingKey(5)).toBe('good_morning');
    expect(greetingKey(11)).toBe('good_morning');
    expect(greetingKey(12)).toBe('good_afternoon');
    expect(greetingKey(18)).toBe('good_evening');
    expect(greetingKey(23)).toBe('good_night');
    expect(greetingKey(2)).toBe('good_night');
    expect(isDaytime(12)).toBe(true);
    expect(isDaytime(21)).toBe(false);
  });
  it('считает «3 из 5», а «Сегодня отдых» не превращает в долг', () => {
    expect(planProgress([item('completed'), item('pending'), item('skipped')])).toEqual({
      completed: 1,
      total: 2,
      allDone: false,
    });
    expect(planProgress([item('completed'), item('skipped')]).allDone).toBe(true);
    expect(planProgress([item('skipped')]).allDone).toBe(false);
    expect(planProgress([])).toEqual({ completed: 0, total: 0, allDone: false });
  });
});

describe('кадр 03: время напоминания', () => {
  it('сдвигается по кругу суток', () => {
    expect(shiftTime('21:00', 15)).toBe('21:15');
    expect(shiftTime('23:45', 30)).toBe('00:15');
    expect(shiftTime('00:10', -15)).toBe('23:55');
    expect(shiftTime('09:30', -60)).toBe('08:30');
  });
});

describe('Огонёк серии (HZ-R12)', () => {
  it('становится горячее с ростом серии', () => {
    const colors = [1, 3, 7, 21].map(flameColor);
    expect(new Set(colors).size).toBe(4);
    expect(flameColor(2)).toBe(flameColor(1));
    expect(flameColor(30)).toBe(flameColor(21));
  });
});
