/**
 * Цвет огонька серии (HZ-R12): чем длиннее серия, тем горячее огонёк.
 * NOTE: Пороги — неделя и три недели подряд; цвета подобраны под светлый чип на холмах.
 */
export function flameColor(streak: number): string {
  if (streak >= 21) return '#C9302C';
  if (streak >= 7) return '#DD4F2A';
  if (streak >= 3) return '#E5672F';
  return '#E5793E';
}
