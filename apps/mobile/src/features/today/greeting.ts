/**
 * Приветствие по времени суток на устройстве (кадр 02: «Доброе утро!»).
 * Чистая функция — проверяется тестами без React.
 */
export type GreetingKey = 'good_morning' | 'good_afternoon' | 'good_evening' | 'good_night';

export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'good_morning';
  if (hour >= 12 && hour < 18) return 'good_afternoon';
  if (hour >= 18 && hour < 23) return 'good_evening';
  return 'good_night';
}

/** Днём рядом с приветствием солнце, вечером и ночью — луна. */
export function isDaytime(hour: number): boolean {
  return hour >= 6 && hour < 19;
}
