import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyReminders } from '../../platform/notifications/reminders';
import { useNotificationPermission } from '../../platform/permissions/useNotificationPermission';
import { useActiveHabits } from '../habits/data/useHabits';
import { useUserSettings } from '../settings/data/useSettings';
import { useTodayPlan } from '../today/data/usePlan';
import { buildReminderPlan } from './plan';

/**
 * Держит локальные напоминания телефона в согласии с аккаунтом: привычки, их время и дни,
 * общий выключатель и вечернее время из «Настроек», язык и разрешение.
 * NOTE: План ставится заново только когда он действительно изменился.
 * С HZ-09 учитывается и сегодняшний план: «N раз в неделю» перестаёт напоминать,
 * когда цель недели набрана, а отмеченная сегодня гибкая привычка — до завтра.
 */
export function ReminderSync() {
  const { t, i18n } = useTranslation(['notifications', 'permissions']);
  const settings = useUserSettings();
  const habits = useActiveHabits();
  const plan = useTodayPlan();
  const permission = useNotificationPermission();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!settings.data || !habits.data || permission.state === null) return;
    const items = plan.data ?? [];
    const now = new Date();
    const reminders = buildReminderPlan({
      enabled: settings.data.remindersEnabled,
      eveningTime: settings.data.reminderTime,
      habits: habits.data,
      ...(plan.data
        ? {
            today: {
              date: items[0]?.localDate ?? now.toISOString().slice(0, 10),
              minutes: now.getHours() * 60 + now.getMinutes(),
              // NOTE: «Сегодня отдых» тоже снимает сегодняшнее напоминание.
              doneToday: new Set(
                items.filter((item) => item.status !== 'pending').map((item) => item.habitId),
              ),
              weekDone: new Map(
                items.filter((item) => item.flexible).map((item) => [item.habitId, item.weekDone]),
              ),
            },
          }
        : {}),
    });
    const key = JSON.stringify([reminders, i18n.language, permission.granted]);
    if (key === applied.current) return;
    applied.current = key;
    void applyReminders(reminders, {
      channelName: t('permissions:channel_name'),
      text: (reminder) =>
        reminder.kind === 'evening'
          ? { title: t('notifications:evening_title'), body: t('notifications:evening_body') }
          : {
              title: t('notifications:habit_title'),
              body: t('notifications:habit_reminder_body', { title: reminder.title }),
            },
    });
  }, [
    settings.data,
    habits.data,
    plan.data,
    permission.state,
    permission.granted,
    i18n.language,
    t,
  ]);

  return null;
}
