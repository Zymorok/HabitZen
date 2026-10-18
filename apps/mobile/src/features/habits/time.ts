/** Сдвиг времени «ЧЧ:ММ» на минуты по кругу суток (23:45 + 30 мин = 00:15). */
export function shiftTime(value: string, minutes: number): string {
  const [hours = '0', mins = '0'] = value.split(':');
  const total = (((Number(hours) * 60 + Number(mins) + minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
