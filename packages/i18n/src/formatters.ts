import type { LocalDate } from '../../core/src/calendar.ts';
import type { SupportedLocale } from './locales.ts';

export function formatCalendarDate(date: LocalDate, locale: SupportedLocale): string {
  // NOTE: Календарная дата уже определена. Повторный сдвиг в пояс устройства изменил бы день.
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(
    new Date(date + 'T12:00:00Z'),
  );
}
export function formatInstant(instant: Date, locale: SupportedLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}
export function formatPercent(value: number, locale: SupportedLocale): string {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Неверная доля.');
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    value,
  );
}
