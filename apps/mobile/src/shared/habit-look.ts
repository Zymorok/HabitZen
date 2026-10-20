import type { IconName } from './ui/icon-names';

/**
 * Внешний вид привычки: значок и цвет. Один источник для плана дня, создания и наград.
 * NOTE: Ключи совпадают с разрешёнными в базе (icon_key, color_key, category).
 */
export type HabitCategory = 'water' | 'reading' | 'fitness' | 'meditation' | 'learning' | 'custom';
export type HabitColor = 'sage' | 'mint' | 'apricot' | 'sand' | 'blue' | 'rose';

export const HABIT_COLORS: Readonly<Record<HabitColor, string>> = {
  sage: '#4F8A5B',
  mint: '#5FB79A',
  apricot: '#EE9A68',
  sand: '#E2BE6A',
  blue: '#6FA3D8',
  rose: '#E58C9C',
};
export const COLOR_ORDER: readonly HabitColor[] = [
  'sage',
  'mint',
  'apricot',
  'sand',
  'blue',
  'rose',
];

/** Значки на выбор (кадр 03). Категория определяется значком — отдельный выбор не нужен. */
export const ICON_CHOICES: readonly {
  readonly icon: IconName;
  readonly category: HabitCategory;
}[] = [
  { icon: 'book', category: 'reading' },
  { icon: 'walk', category: 'fitness' },
  { icon: 'leaf', category: 'meditation' },
  { icon: 'drop', category: 'water' },
  { icon: 'system', category: 'learning' },
  { icon: 'heart', category: 'custom' },
  // NOTE: HZ-10 — ещё девять значков; категория в базе — из прежних шести.
  { icon: 'moon', category: 'meditation' },
  { icon: 'dumbbell', category: 'fitness' },
  { icon: 'run', category: 'fitness' },
  { icon: 'apple', category: 'custom' },
  { icon: 'pencil', category: 'reading' },
  { icon: 'music', category: 'learning' },
  { icon: 'pill', category: 'custom' },
  { icon: 'coin', category: 'custom' },
  { icon: 'phoneOff', category: 'meditation' },
];

const KNOWN_ICONS = new Set<string>(ICON_CHOICES.map((choice) => choice.icon).concat(['sun']));

/** Значок из базы может быть старым или неизвестным приложению — тогда показываем листик. */
export function habitIcon(key: string): IconName {
  return KNOWN_ICONS.has(key) ? (key as IconName) : 'leaf';
}

export function habitColor(key: string): string {
  return HABIT_COLORS[key as HabitColor] ?? HABIT_COLORS.sage;
}
