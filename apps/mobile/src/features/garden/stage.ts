import { MAX_LEVEL } from '@habitzen/core/garden';

/**
 * Какой рисунок дерева показывать на уровне (кадр 10). Рисунков 7, уровней 10:
 * 1 — росток, 2 — саженец, 3 — молодое дерево, 4 — дерево, 5–6 — цветение,
 * 7–8 — плоды, 9–10 — большое старое дерево.
 */
const STAGE_BY_LEVEL = [0, 1, 2, 3, 4, 4, 5, 5, 6, 6] as const;
export const STAGE_COUNT = 7;

export function stageIndex(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return STAGE_BY_LEVEL[clamped - 1] ?? 0;
}

/** Карточки уровней под деревом: четыре подряд, текущий уровень — последний из открытых. */
export function stageCards(level: number): number[] {
  const first = Math.max(1, Math.min(level, MAX_LEVEL) - 3);
  return [first, first + 1, first + 2, first + 3];
}
