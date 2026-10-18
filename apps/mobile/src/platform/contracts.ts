import type { SupportedLocale } from '../../../../packages/i18n/src/locales.ts';

export interface HapticsGateway {
  lightImpact(): Promise<void>;
  success(): Promise<void>;
}
export interface ReminderDescription {
  readonly id: string;
  readonly ownerId: string;
  readonly habitId: string;
  readonly localTime: string;
  readonly timeZone: string;
  readonly language: SupportedLocale;
}
export interface NotificationsGateway {
  permission(): Promise<'granted' | 'denied' | 'undetermined'>;
  replaceOwnedReminders(ownerId: string, reminders: readonly ReminderDescription[]): Promise<void>;
  cancelForOwner(ownerId: string): Promise<void>;
}
export interface AudioGateway {
  play(sound: 'rain' | 'forest' | 'white_noise'): Promise<void>;
  stop(): Promise<void>;
}
// NOTE: Платформенные реализации появятся с приложением; права и состояние сети не маскируются успехом.
