import { describe, expect, it } from 'vitest';
import { addCalendarDays, dateInTimeZone, localDate } from '../../packages/core/src/calendar.ts';

describe('Календарные даты пользователя', () => {
  it('различает день UTC и день пользователя около полуночи', () => {
    const instant = new Date('2026-10-17T22:30:00Z');
    expect(dateInTimeZone(instant, 'Europe/Warsaw')).toBe('2026-10-18');
    expect(dateInTimeZone(instant, 'America/New_York')).toBe('2026-10-17');
  });
  it('переходит через весеннюю смену времени календарным днём', () => {
    expect(addCalendarDays(localDate('2026-03-28'), 1)).toBe('2026-03-29');
    expect(addCalendarDays(localDate('2026-03-29'), 1)).toBe('2026-03-30');
  });
  it('переходит через осеннюю смену времени без повтора даты', () => {
    expect(addCalendarDays(localDate('2026-10-25'), 1)).toBe('2026-10-26');
  });
  it('правильно обрабатывает високосный год и границу года', () => {
    expect(addCalendarDays(localDate('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addCalendarDays(localDate('2026-12-31'), 1)).toBe('2027-01-01');
  });
  it.each(['2026-02-30', '2026-13-01', '17.10.2026', '2026-1-01'])(
    'отклоняет неверную дату %s',
    (date) => {
      expect(() => localDate(date)).toThrow();
    },
  );
  it('отклоняет неизвестный часовой пояс', () => {
    expect(() => dateInTimeZone(new Date(), 'Wrong/Zone')).toThrow();
  });
});
