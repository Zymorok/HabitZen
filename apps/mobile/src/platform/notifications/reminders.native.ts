import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { mobileLogger } from '../../core/diagnostics/mobile-logger';
import type { PlannedReminder } from '../../features/reminders/plan';

const PREFIX = 'habitzen-reminder-';
// NOTE: Тот же канал, что создаёт экран разрешения при знакомстве (app.json: defaultChannel).
const CHANNEL = 'gentle-reminders';

export interface ReminderTexts {
  readonly channelName: string;
  text(reminder: PlannedReminder): { readonly title: string; readonly body: string };
}

async function cancelOwn(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

/**
 * Ставит план напоминаний целиком: сначала снимает прежние напоминания HabitZen, затем
 * ставит новые. Без разрешения ничего не ставится — и это не ошибка.
 * NOTE: Возвращает число поставленных системных уведомлений (для проверок и журнала).
 */
export async function applyReminders(
  plan: readonly PlannedReminder[],
  texts: ReminderTexts,
): Promise<number> {
  try {
    await cancelOwn();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted || plan.length === 0) return 0;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: texts.channelName,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let count = 0;
    for (const reminder of plan) {
      const content = texts.text(reminder);
      if (reminder.weekdays === null) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${reminder.id}-daily`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: reminder.hour,
            minute: reminder.minute,
            channelId: CHANNEL,
          },
        });
        count += 1;
        continue;
      }
      for (const weekday of reminder.weekdays) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${reminder.id}-${weekday}`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            // NOTE: В Expo неделя начинается с воскресенья (1), у нас — с понедельника (ISO).
            weekday: (weekday % 7) + 1,
            hour: reminder.hour,
            minute: reminder.minute,
            channelId: CHANNEL,
          },
        });
        count += 1;
      }
    }
    void mobileLogger.emit('info', 'system', 'reminders.applied', { count });
    return count;
  } catch {
    void mobileLogger.emit('warning', 'system', 'reminders.apply_failed');
    return 0;
  }
}

/** Выход из аккаунта: напоминания и уведомление таймера этого аккаунта снимаются. */
export async function cancelAllReminders(): Promise<void> {
  try {
    await cancelOwn();
    await Notifications.cancelScheduledNotificationAsync('habitzen-focus-end');
  } catch {
    void mobileLogger.emit('warning', 'system', 'reminders.cancel_failed');
  }
}
