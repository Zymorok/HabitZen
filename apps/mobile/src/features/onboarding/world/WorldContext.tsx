import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Всё, что нужно слоям мира: часы, день/ночь, прокрутка страниц и размеры.
 * NOTE: Живые примеры на страницах (привычки, дерево) пишут сюда свои значения,
 * а мир на них отвечает: отмеченная привычка — росток на грядке подрастает.
 */
export interface WorldState {
  readonly time: SharedValue<number>;
  readonly night: SharedValue<number>;
  readonly scrollX: SharedValue<number>;
  /** Ширина одной страницы. */
  readonly width: number;
  /** Высота всего экрана. */
  readonly height: number;
  /** Линия земли: на ней стоят главные объекты страниц. */
  readonly groundY: number;
  readonly animate: boolean;
  /** Рост трёх ростков на грядке (страница 2), 0…1. */
  readonly gardenGrowth: readonly [SharedValue<number>, SharedValue<number>, SharedValue<number>];
  /** Рост дерева между уровнями (страница 4), 0 — саженец, 1 — взрослое дерево. */
  readonly treeGrowth: SharedValue<number>;
  /** Вспышка лунного ореола, когда волк воет, 0…1. */
  readonly howl: SharedValue<number>;
}

const Context = createContext<WorldState | null>(null);
export const WorldProvider = Context.Provider;

export function useWorld(): WorldState {
  const value = useContext(Context);
  if (!value) throw new Error('Слой мира использован вне WorldProvider.');
  return value;
}
