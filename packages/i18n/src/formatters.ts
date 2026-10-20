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

/** Заголовок месяца календаря: «Октябрь»; для другого года — «Октябрь 2025». */
export function formatMonthTitle(
  date: LocalDate,
  locale: SupportedLocale,
  withYear: boolean,
): string {
  // NOTE: Месяц без числа Intl отдаёт в именительном падеже («октябрь», а не «октября»).
  const month = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long' }).format(
    new Date(date + 'T12:00:00Z'),
  );
  const title = month.charAt(0).toLocaleUpperCase(locale) + month.slice(1);
  return withYear ? `${title} ${date.slice(0, 4)}` : title;
}

/** Короткие названия дней недели, начиная с понедельника: «ПН», «ВТ», … */
export function weekdayLabels(locale: SupportedLocale): string[] {
  const format = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' });
  // NOTE: 5 января 2026 года — понедельник.
  return Array.from({ length: 7 }, (_, index) =>
    format
      .format(new Date(Date.UTC(2026, 0, 5 + index, 12)))
      .replace('.', '')
      .slice(0, 3)
      .toLocaleUpperCase(locale),
  );
}

/** Короткий месяц для подписи годовой карты: «окт», «Oct» — ровно три буквы, чтобы не налезали. */
export function formatShortMonth(date: LocalDate, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' })
    .format(new Date(date + 'T12:00:00Z'))
    .replace('.', '')
    .slice(0, 3);
}

/** Неделя для «Итогов недели»: «13–19 октября», «October 13–19», «29 сентября – 5 октября». */
export function formatDateRange(from: LocalDate, to: LocalDate, locale: SupportedLocale): string {
  if (from.slice(0, 7) !== to.slice(0, 7))
    return `${formatCalendarDate(from, locale)} – ${formatCalendarDate(to, locale)}`;
  return locale === 'en'
    ? `${formatCalendarDate(from, locale)}–${Number(to.slice(8))}`
    : `${Number(from.slice(8))}–${formatCalendarDate(to, locale)}`;
}
