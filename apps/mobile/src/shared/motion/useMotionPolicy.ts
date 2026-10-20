import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useOptionalPreferences } from '../../core/providers/AppPreferencesProvider';

/**
 * Можно ли сейчас показывать непрерывное движение.
 * NOTE: Учитывает системное «Уменьшение движения», выключатель «Меньше движения» в настройках
 * приложения и сворачивание: в фоне бесконечные циклы не нужны и только тратят батарею.
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
  const preferences = useOptionalPreferences();
  const reduced = reducedMotion || Boolean(preferences?.preferences.reducedMotion);
  return { reducedMotion: reduced, foreground, animate: foreground && !reduced };
}
