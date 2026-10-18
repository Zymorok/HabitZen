import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Можно ли сейчас показывать непрерывное движение.
 * NOTE: Учитывает системное «Уменьшение движения» и сворачивание приложения:
 * в фоне бесконечные циклы не нужны и только тратят батарею.
 */
export function useMotionPolicy() {
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return { reducedMotion, foreground, animate: foreground && !reducedMotion };
}
