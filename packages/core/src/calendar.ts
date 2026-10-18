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

/** День недели по ISO: 0 — понедельник, 6 — воскресенье. */
export function isoWeekday(date: LocalDate): number {
  return (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

export function startOfIsoWeek(date: LocalDate): LocalDate {
  return addCalendarDays(date, -isoWeekday(date));
}

/** Первое число месяца, сдвинутого на amount месяцев от месяца даты. */
export function shiftMonth(date: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) throw new RangeError('Сдвиг месяца должен быть целым.');
  const value = new Date(date.slice(0, 7) + '-01T00:00:00Z');
  value.setUTCMonth(value.getUTCMonth() + amount);
  return localDate(value.toISOString().slice(0, 10));
}

/** Все дни месяца, в котором лежит дата, по порядку. */
export function monthDays(date: LocalDate): LocalDate[] {
  const first = shiftMonth(date, 0);
  const next = shiftMonth(date, 1);
  const days: LocalDate[] = [];
  for (let day = first; day < next; day = addCalendarDays(day, 1)) days.push(day);
  return days;
}
