import type { HabitColor } from '../../shared/habit-look';
import type { IconName } from '../../shared/ui/icon-names';
import type { Frequency, GoalUnit, TimeOfDay } from './goal';

/**
 * «Быстрый старт» и подбор значка по названию (HZ-10). Чистые правила — их проверяют тесты.
 * NOTE: Шаблон только заполняет форму: человек может всё поменять перед сохранением.
 */
export interface HabitTemplate {
  readonly key: string;
  readonly icon: IconName;
  readonly color: HabitColor;
  readonly goalTarget: number;
  readonly goalUnit: GoalUnit;
  readonly timeOfDay: TimeOfDay;
  readonly frequency: Frequency;
  readonly perWeek?: number;
}

export const TEMPLATES: readonly HabitTemplate[] = [
  {
    key: 'water',
    icon: 'drop',
    color: 'blue',
    goalTarget: 8,
    goalUnit: 'glasses',
    timeOfDay: 'morning',
    frequency: 'days',
  },
  {
    key: 'reading',
    icon: 'book',
    color: 'apricot',
    goalTarget: 20,
    goalUnit: 'minutes',
    timeOfDay: 'evening',
    frequency: 'days',
  },
  {
    key: 'walk',
    icon: 'walk',
    color: 'sand',
    goalTarget: 6000,
    goalUnit: 'steps',
    timeOfDay: 'afternoon',
    frequency: 'days',
  },
  {
    key: 'meditation',
    icon: 'leaf',
    color: 'rose',
    goalTarget: 10,
    goalUnit: 'minutes',
    timeOfDay: 'morning',
    frequency: 'days',
  },
  {
    key: 'sleep',
    icon: 'moon',
    color: 'blue',
    goalTarget: 1,
    goalUnit: 'times',
    timeOfDay: 'evening',
    frequency: 'days',
  },
  {
    key: 'gym',
    icon: 'dumbbell',
    color: 'mint',
    goalTarget: 1,
    goalUnit: 'times',
    timeOfDay: 'any',
    frequency: 'weekly',
    perWeek: 3,
  },
  {
    key: 'journal',
    icon: 'pencil',
    color: 'sand',
    goalTarget: 1,
    goalUnit: 'times',
    timeOfDay: 'evening',
    frequency: 'days',
  },
  {
    key: 'vitamins',
    icon: 'pill',
    color: 'mint',
    goalTarget: 1,
    goalUnit: 'times',
    timeOfDay: 'morning',
    frequency: 'days',
  },
  {
    key: 'phone',
    icon: 'phoneOff',
    color: 'sage',
    goalTarget: 1,
    goalUnit: 'times',
    timeOfDay: 'evening',
    frequency: 'days',
  },
];

/** Цвет, который подходит значку, если человек ещё не выбрал свой. */
export const ICON_COLOR: Readonly<Partial<Record<IconName, HabitColor>>> = {
  drop: 'blue',
  book: 'apricot',
  walk: 'sand',
  leaf: 'rose',
  system: 'blue',
  heart: 'rose',
  moon: 'blue',
  dumbbell: 'mint',
  run: 'apricot',
  apple: 'sage',
  pencil: 'sand',
  music: 'rose',
  pill: 'mint',
  coin: 'sand',
  phoneOff: 'sage',
};

// NOTE: Начала слов на русском, украинском и английском; порядок важен — первое совпадение.
const KEYWORDS: readonly (readonly [IconName, readonly string[]])[] = [
  ['drop', ['вод', 'пить', 'выпить', 'пий', 'water', 'drink', 'hydrat']],
  ['run', ['бег', 'пробеж', 'біг', 'run', 'jog']],
  [
    'dumbbell',
    [
      'зал',
      'трен',
      'спорт',
      'отжим',
      'присед',
      'віджим',
      'gym',
      'workout',
      'push',
      'squat',
      'fitness',
    ],
  ],
  ['walk', ['прогул', 'гуля', 'шаг', 'ходь', 'пішк', 'крок', 'walk', 'step', 'hike']],
  ['moon', ['сон', 'спать', 'засып', 'лечь', 'лягти', 'sleep', 'bed']],
  ['leaf', ['медит', 'дыха', 'дихан', 'йог', 'meditat', 'breath', 'yoga', 'calm']],
  ['book', ['чит', 'книг', 'прочит', 'read', 'book']],
  ['pencil', ['дневник', 'журнал', 'запис', 'напис', 'щоденн', 'journal', 'diary', 'write']],
  [
    'system',
    [
      'англ',
      'язык',
      'учи',
      'урок',
      'курс',
      'мов',
      'вивч',
      'english',
      'learn',
      'study',
      'lesson',
      'course',
      'code',
      'код',
    ],
  ],
  ['music', ['музык', 'гитар', 'пиани', 'петь', 'музик', 'music', 'guitar', 'piano', 'sing']],
  [
    'apple',
    [
      'еда',
      'еды',
      'еду',
      'питан',
      'овощ',
      'фрукт',
      'салат',
      'сахар',
      'їжа',
      'овоч',
      'food',
      'eat',
      'fruit',
      'veget',
      'sugar',
    ],
  ],
  ['pill', ['витамин', 'таблет', 'лекар', 'вітамін', 'ліки', 'vitamin', 'pill', 'medic']],
  [
    'coin',
    ['деньг', 'копи', 'бюджет', 'трат', 'гроші', 'заощад', 'money', 'save', 'budget', 'spend'],
  ],
  ['phoneOff', ['телефон', 'соцсет', 'экран', 'смартф', 'phone', 'screen', 'social']],
];

/**
 * Значок по названию: «Выпить воду» — капля, «Бег по утрам» — кроссовок в движении.
 * Совпадение ищется по началу слова, чтобы «еда» не находилась внутри «среда».
 */
export function suggestIcon(title: string): IconName | null {
  const words = title
    .toLocaleLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  for (const [icon, stems] of KEYWORDS) {
    if (words.some((word) => stems.some((stem) => word.startsWith(stem)))) return icon;
  }
  return null;
}
