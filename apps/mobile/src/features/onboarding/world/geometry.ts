/**
 * Геометрия мира первого запуска. Чистые функции без React — их легко проверить тестами.
 *
 * NOTE: Пять страниц — это одна длинная панорама. Чем дальше слой, тем медленнее он
 * едет при перелистывании (параллакс). Так плоские картинки дают ощущение глубины.
 */

export const PAGE_COUNT = 5;

/** Во сколько раз медленнее страницы движется слой. 1 — вместе со страницей. */
export const depth = {
  stars: 0.03,
  sky: 0.015,
  clouds: 0.06,
  mountains: 0.12,
  hills: 0.32,
  ground: 1,
  // NOTE: Ближний план едет быстрее страницы — самая сильная подсказка глубины.
  foreground: 1.22,
} as const;

/** Какой ширины должен быть слой, чтобы его хватило на все пять страниц. */
export function layerWidth(pageWidth: number, factor: number): number {
  return pageWidth * (1 + (PAGE_COUNT - 1) * factor);
}

/**
 * Высоты линий горизонта. Всё небо (солнце, луна, облака, птицы) держится над хребтом гор,
 * а хребет — под текстом страницы.
 * NOTE: Отсчёт от линии земли, чтобы на высоких и низких экранах сцена собиралась одинаково.
 */
export function skyline(width: number, groundY: number, height: number) {
  const mountainRidge = Math.max(groundY - width * 0.64, height * 0.4);
  return {
    mountainRidge,
    hillRidge: Math.max(groundY - width * 0.38, height * 0.5),
    sunY: mountainRidge - width * 0.14,
    moonY: mountainRidge - width * 0.16,
    cloudTop: mountainRidge - width * 0.3,
    cloudBottom: mountainRidge + width * 0.02,
    birdY: mountainRidge - width * 0.22,
  };
}

/** Плавная ступенька 0→1 между edge0 и edge1. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

/**
 * Предсказуемый генератор случайных чисел: звёзды и травинки при каждом запуске
 * стоят на одних и тех же местах, и снимки экрана в тестах не «гуляют».
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ветер: медленно нарастает и стихает, чтобы трава качалась не как метроном. */
export function wind(time: number): number {
  'worklet';
  return 0.72 + 0.28 * Math.sin(time * 0.37 + 1.3) * Math.sin(time * 0.13 + 0.4);
}

/** Угол покачивания травинки или листа в градусах. */
export function swayAngle(time: number, amplitude: number, speed: number, phase: number): number {
  'worklet';
  const main = Math.sin(time * speed + phase);
  const flutter = Math.sin(time * speed * 2.7 + phase * 1.9) * 0.22;
  return amplitude * wind(time) * (main * 0.8 + flutter);
}
