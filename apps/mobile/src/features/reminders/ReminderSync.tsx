import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyReminders } from '../../platform/notifications/reminders';
import { useNotificationPermission } from '../../platform/permissions/useNotificationPermission';
import { useActiveHabits } from '../habits/data/useHabits';
import { useUserSettings } from '../settings/data/useSettings';
import { buildReminderPlan } from './plan';

/**
 * Держит локальные напоминания телефона в согласии с аккаунтом: привычки, их время и дни,
 * общий выключатель и вечернее время из «Настроек», язык и разрешение.
 * NOTE: План ставится заново только когда он действительно изменился.
 */
export function ReminderSync() {
  const { t, i18n } = useTranslation(['notifications', 'permissions']);
  const settings = useUserSettings();
  const habits = useActiveHabits();
  const permission = useNotificationPermission();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!settings.data || !habits.data || permission.state === null) return;
    const plan = buildReminderPlan({
      enabled: settings.data.remindersEnabled,
      eveningTime: settings.data.reminderTime,
      habits: habits.data,
    });
    const key = JSON.stringify([plan, i18n.language, permission.granted]);
    if (key === applied.current) return;
    applied.current = key;
    void applyReminders(plan, {
      channelName: t('permissions:channel_name'),
      text: (reminder) =>
        reminder.kind === 'evening'
          ? { title: t('notifications:evening_title'), body: t('notifications:evening_body') }
          : {
              title: t('notifications:habit_title'),
              body: t('notifications:habit_reminder_body', { title: reminder.title }),
            },
    });
  }, [settings.data, habits.data, permission.state, permission.granted, i18n.language, t]);

  return null;
}
