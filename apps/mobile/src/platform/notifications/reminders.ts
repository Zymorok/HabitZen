// NOTE: Metro выбирает .native.ts или .web.ts; этот экспорт нужен инструментам TypeScript.
export { applyReminders, cancelAllReminders } from './reminders.native';
export type { ReminderTexts } from './reminders.native';
