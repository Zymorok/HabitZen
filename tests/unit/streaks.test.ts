import { describe, expect, it } from 'vitest';
import { localDate } from '../../packages/core/src/calendar.ts';
import {
  FREEZE_EVERY,
  MAX_FREEZES,
  summarizeStreaks,
  summarizeWithFreezes,
} from '../../packages/core/src/streaks.ts';
import { addCalendarDays } from '../../packages/core/src/calendar.ts';
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

/** Подряд идущие дни с заданными итогами, заканчивая сегодняшним. */
function history(outcomes: string): ScheduledDay[] {
  const map = { c: 'completed', m: 'missed', r: 'rest' } as const;
  return [...outcomes].map((letter, index) => ({
    date: addCalendarDays(today, index - outcomes.length + 1),
    outcome: map[letter as keyof typeof map],
  }));
}

describe('Заморозка серии (HZ-08)', () => {
  it('семь выполненных дней дают заморозку, и она закрывает пропуск', () => {
    const summary = summarizeWithFreezes(history('cccccccmcc'), today);
    expect(summary.current).toBe(9);
    expect(summary.freezes).toBe(0);
    expect(summary.frozen).toEqual([addCalendarDays(today, -2)]);
    // NOTE: Без заморозки та же история оборвала бы серию.
    expect(summarizeStreaks(history('cccccccmcc'), today).current).toBe(2);
  });
  it('без запаса пропуск обрывает серию', () => {
    const summary = summarizeWithFreezes(history('ccccccmcc'), today);
    expect(summary.current).toBe(2);
    expect(summary.frozen).toEqual([]);
    // NOTE: Седьмой выполненный день пришёлся уже после пропуска — заморозка появилась позже.
    expect(summary.freezes).toBe(1);
    expect(summary.nextFreezeIn).toBe(FREEZE_EVERY - 1);
  });
  it('копит не больше двух заморозок', () => {
    const summary = summarizeWithFreezes(history('c'.repeat(30)), today);
    expect(summary.freezes).toBe(MAX_FREEZES);
    expect(summary.nextFreezeIn).toBe(0);
  });
  it('не тратит заморозку, когда спасать нечего, и не трогает сегодняшний день', () => {
    const summary = summarizeWithFreezes(history('cccccccmmrcm'), today);
    // Первый пропуск закрыт, второй уже нечем, третий — сегодня и ещё не пропуск.
    expect(summary.frozen).toEqual([addCalendarDays(today, -4)]);
    expect(summary.current).toBe(1);
    expect(summary.best).toBe(7);
  });
});
