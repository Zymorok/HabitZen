import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { mobileLogger } from '../../core/diagnostics/mobile-logger';

const CHANNEL = 'focus-timer';
// NOTE: Одно уведомление на аккаунт: новое расписание заменяет старое, дублей после перезапуска нет.
const IDENTIFIER = 'habitzen-focus-end';

/**
 * Уведомление «Время вышло» на сроке окончания — на случай, если приложение свёрнуто.
 * NOTE: Разрешение здесь не запрашивается: его спрашивают при знакомстве и в настройках.
 * Без разрешения таймер работает так же, просто без уведомления.
 */
export async function scheduleFocusAlert(
  atMs: number,
  content: { readonly title: string; readonly body: string; readonly channelName: string },
): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    if (atMs <= Date.now() + 1000) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: content.channelName,
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: { title: content.title, body: content.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(atMs),
        channelId: CHANNEL,
      },
    });
    return true;
  } catch {
    void mobileLogger.emit('warning', 'focus', 'focus.alert_schedule_failed');
    return false;
  }
}

export async function cancelFocusAlert(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  } catch {
    void mobileLogger.emit('warning', 'focus', 'focus.alert_cancel_failed');
  }
}
