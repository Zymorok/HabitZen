import { describe, expect, it } from 'vitest';
import { localDate } from '../../packages/core/src/calendar.ts';
import { summarizeStreaks } from '../../packages/core/src/streaks.ts';
import type { ScheduledDay } from '../../packages/core/src/streaks.ts';

const today = localDate('2026-10-17');
describe('Серии запланированных дней', () => {
  it('не объявляет серию достоверной при пробеле в календаре', () => {
    expect(() =>
      summarizeStreaks(
        [
          { date: localDate('2026-10-15'), outcome: 'completed' },
          { date: today, outcome: 'completed' },
        ],
        today,
      ),
    ).toThrow();
  });
  it('не обрывает серию до конца сегодняшнего дня', () => {
    expect(
      summarizeStreaks(
        [
          { date: localDate('2026-10-16'), outcome: 'completed' },
          { date: today, outcome: 'missed' },
        ],
        today,
      ),
    ).toEqual({ current: 1, best: 1 });
  });
  it('обрывает серию после пропуска и сохраняет лучший результат', () => {
    const days: ScheduledDay[] = [
      { date: localDate('2026-10-13'), outcome: 'completed' },
      { date: localDate('2026-10-14'), outcome: 'completed' },
      { date: localDate('2026-10-15'), outcome: 'missed' },
      { date: localDate('2026-10-16'), outcome: 'completed' },
    ];
    expect(summarizeStreaks(days, today)).toEqual({ current: 1, best: 2 });
  });
  it('не штрафует за незапланированный день отдыха', () => {
    expect(
      summarizeStreaks(
        [
          { date: localDate('2026-10-15'), outcome: 'completed' },
          { date: localDate('2026-10-16'), outcome: 'rest' },
          { date: today, outcome: 'completed' },
        ],
        today,
      ),
    ).toEqual({ current: 2, best: 2 });
  });
  it('не учитывает будущие отметки', () => {
    expect(
      summarizeStreaks([{ date: localDate('2026-10-18'), outcome: 'completed' }], today),
    ).toEqual({ current: 0, best: 0 });
  });
  it('не удваивает результат при дубликате дня', () => {
    expect(() =>
      summarizeStreaks(
        [
          { date: today, outcome: 'completed' },
          { date: today, outcome: 'completed' },
        ],
        today,
      ),
    ).toThrow();
  });
});
