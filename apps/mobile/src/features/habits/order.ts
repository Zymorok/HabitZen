/**
 * Порядок привычек при перетаскивании (HZ-09). Чистые правила — их проверяют тесты,
 * а список на экране вызывает их во время жеста (поэтому функции помечены как worklet).
 */
export type Positions = Readonly<Record<string, number>>;

export function positionsOf(ids: readonly string[]): Positions {
  return Object.fromEntries(ids.map((id, index) => [id, index]));
}

/** Переносит строку с места from на место to; остальные сдвигаются на одну позицию. */
export function moveItem(positions: Positions, from: number, to: number): Positions {
  'worklet';
  const next: Record<string, number> = {};
  for (const key of Object.keys(positions)) {
    const position = positions[key] ?? 0;
    if (position === from) next[key] = to;
    else if (from < to && position > from && position <= to) next[key] = position - 1;
    else if (from > to && position >= to && position < from) next[key] = position + 1;
    else next[key] = position;
  }
  return next;
}

/** Место строки по смещению пальца: ближайшая позиция, не выходя за края списка. */
export function slotAt(offset: number, rowHeight: number, count: number): number {
  'worklet';
  return Math.max(0, Math.min(count - 1, Math.round(offset / rowHeight)));
}

export function orderOf(positions: Positions): string[] {
  return Object.keys(positions).sort(
    (left, right) => (positions[left] ?? 0) - (positions[right] ?? 0),
  );
}
