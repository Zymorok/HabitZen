import type { PlannedReminder } from '../../features/reminders/plan';

/**
 * NOTE: В браузере напоминания не ставятся: вкладка закрыта — уведомлять некому.
 * Настройки при этом сохраняются и сработают на телефоне.
 */
export interface ReminderTexts {
  readonly channelName: string;
  text(reminder: PlannedReminder): { readonly title: string; readonly body: string };
}

export async function applyReminders(
  _plan: readonly PlannedReminder[],
  _texts: ReminderTexts,
): Promise<number> {
  void _plan;
  void _texts;
  return 0;
}

export async function cancelAllReminders(): Promise<void> {}
