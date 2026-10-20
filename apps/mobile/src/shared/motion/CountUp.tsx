import { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { AppText } from '../ui/AppText';
import { useMotionPolicy } from './useMotionPolicy';

/**
 * Число, которое «досчитывает» до нового значения за 0,7 с — для «Итогов недели».
 * NOTE: При «Меньше движения» число сразу показывается целиком, без счёта.
 * PERF: Счёт идёт кадрами requestAnimationFrame и останавливается, когда экран ушёл.
 */
export function CountUp({
  value,
  format = String,
  duration = 700,
  style,
  testID,
}: {
  readonly value: number;
  readonly format?: (value: number) => string;
  readonly duration?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
}) {
  const { animate } = useMotionPolicy();
  const [shown, setShown] = useState(animate ? 0 : value);
  const from = useRef(shown);
  useEffect(() => {
    if (!animate) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const origin = from.current;
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      // NOTE: Замедление к концу: последние единицы добавляются неторопливо.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(origin + (value - origin) * eased);
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, duration]);
  return (
    <AppText style={style} testID={testID}>
      {format(shown)}
    </AppText>
  );
}
