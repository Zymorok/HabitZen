export const motion = {
  holdToCompleteMs: 1200,
  holdHapticIntervalMs: 200,
  breathInMs: 4000,
  breathOutMs: 4000,
  breathDiameter: { from: 180, to: 240 },
  successScale: { from: 1.15, to: 1 },
  spring: { damping: 18, stiffness: 180, mass: 0.8 },
  // NOTE: За это время солнце садится, небо темнеет и восходит луна — смена темы ощущается как вечер.
  themeTransitionMs: 1200,
  // NOTE: Текст при смене языка сначала уходит, потом появляется новый; вместе меньше полсекунды.
  languageOutMs: 170,
  languageInMs: 320,
  pressSpring: { damping: 15, stiffness: 320, mass: 0.6 },
  treeGrowthMs: 700,
} as const;
// NOTE: Уменьшение движения отключает пульсации и конфетти, сохраняя понятный итог действия.
