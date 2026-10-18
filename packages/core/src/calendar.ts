export type LocalDate = string & { readonly __localDate: unique symbol };

export function localDate(value: string): LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Дата должна иметь вид ГГГГ-ММ-ДД.');
  }
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Такой календарной даты не существует.');
  }
  return value as LocalDate;
}

export function dateInTimeZone(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return localDate(part('year') + '-' + part('month') + '-' + part('day'));
}

export function addCalendarDays(date: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) throw new RangeError('Сдвиг даты должен быть целым.');
  // NOTE: UTC используется только для арифметики календарных дат, а не для определения дня пользователя.
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + amount);
  return localDate(value.toISOString().slice(0, 10));
}
