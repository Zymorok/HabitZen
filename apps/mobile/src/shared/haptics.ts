import { useMemo } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useOptionalPreferences } from '../core/providers/AppPreferencesProvider';

/**
 * Вибрация приложения в одном месте (HZ-R10): учитывает выключатель «Вибрация» в настройках
 * и молчит в браузере. Ошибки моторчика не мешают действию — они просто глотаются.
 */
export function useHaptics() {
  const preferences = useOptionalPreferences();
  const enabled = Platform.OS !== 'web' && (preferences?.preferences.haptics ?? true);
  return useMemo(() => {
    const safe = (run: () => Promise<void>) => {
      if (enabled) void run().catch(() => undefined);
    };
    return {
      enabled,
      /** Лёгкий отклик: нажатие кнопки и тики удержания (каждые 200 мс). */
      light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      selection: () => safe(() => Haptics.selectionAsync()),
      /** Итоговый отклик: привычка выполнена, занятие закончено, награда, новый уровень. */
      success: () =>
        safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    };
  }, [enabled]);
}
