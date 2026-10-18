import { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useMotionPolicy } from './useMotionPolicy';

// NOTE: Ненулевой старт, чтобы синусоиды разных элементов не начинались в одной фазе.
const START_SECONDS = 37.5;
// NOTE: После паузы или подвисания кадр не должен «перематывать» сцену рывком.
const MAX_STEP_MS = 64;

/**
 * Общие часы сцены в секундах. Все покачивания, мерцания и полёты считают положение от них.
 * PERF: Один счётчик на UI-потоке вместо десятков отдельных бесконечных анимаций.
 * Часы стоят, если включено «Уменьшение движения» или приложение свёрнуто.
 */
export function useWorldClock() {
  const { animate, reducedMotion } = useMotionPolicy();
  const time = useSharedValue(START_SECONDS);
  const frame = useFrameCallback((info) => {
    const step = Math.min(info.timeSincePreviousFrame ?? 16, MAX_STEP_MS);
    time.value += step / 1000;
  }, false);
  useEffect(() => {
    frame.setActive(animate);
  }, [animate, frame]);
  return { time, animate, reducedMotion };
}
