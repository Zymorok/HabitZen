/**
 * Рост дерева (HZ-R13). Уровень выводится из подтверждённых выполнений: одна отметка — один
 * вклад, отмена его убирает. Порог уровня N — суммарно 5 × N × (N − 1) выполнений,
 * уровни 1–10: 0, 10, 30, 60, 100, 150, 210, 280, 360, 450.
 * NOTE: Каждый следующий уровень требует на 10 выполнений больше предыдущего — рост
 * заметен в первые дни и не становится бесконечным.
 */
export const MAX_LEVEL = 10;

export function levelThreshold(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError('Уровень дерева — целое число от 1 до 10.');
  }
  return 5 * level * (level - 1);
}

export interface GardenLevel {
  readonly level: number;
  /** Выполнено внутри текущего уровня. */
  readonly progress: number;
  /** Сколько нужно на весь текущий уровень; null — достигнут последний уровень. */
  readonly needed: number | null;
}

export function gardenLevel(completedTotal: number): GardenLevel {
  if (!Number.isInteger(completedTotal) || completedTotal < 0) {
    throw new RangeError('Число выполнений — целое и не меньше нуля.');
  }
  let level = 1;
  while (level < MAX_LEVEL && completedTotal >= levelThreshold(level + 1)) level += 1;
  const floor = levelThreshold(level);
  if (level === MAX_LEVEL) return { level, progress: completedTotal - floor, needed: null };
  return { level, progress: completedTotal - floor, needed: levelThreshold(level + 1) - floor };
}
