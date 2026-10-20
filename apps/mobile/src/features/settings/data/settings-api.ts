import { supabase } from '../../../core/supabase/client';

/**
 * Настройки аккаунта на сервере (кадр 12): звуки, напоминания и звук фокуса.
 * NOTE: Тема и язык хранятся на устройстве (AppPreferencesProvider) — у телефона и
 * компьютера они могут отличаться. Звуки и напоминания одни на все устройства.
 */
export type FocusSound = 'none' | 'rain' | 'forest' | 'white_noise';

export interface UserSettings {
  readonly soundsEnabled: boolean;
  readonly remindersEnabled: boolean;
  /** «ЧЧ:ММ» — время вечернего напоминания. */
  readonly reminderTime: string;
  readonly focusSound: FocusSound;
}

interface SettingsRow {
  sounds_enabled: boolean;
  reminders_enabled: boolean;
  reminder_time: string;
  focus_sound: FocusSound;
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

export async function fetchSettings(): Promise<UserSettings> {
  const { data, error } = await client()
    .from('user_settings')
    .select('sounds_enabled, reminders_enabled, reminder_time, focus_sound')
    .single();
  if (error) throw error;
  const row = data as SettingsRow;
  return {
    soundsEnabled: row.sounds_enabled,
    remindersEnabled: row.reminders_enabled,
    // NOTE: PostgreSQL отдаёт время как «21:00:00» — на экране нужны часы и минуты.
    reminderTime: row.reminder_time.slice(0, 5),
    focusSound: row.focus_sound,
  };
}

export async function saveSettings(ownerId: string, patch: Partial<UserSettings>): Promise<void> {
  const row: Partial<SettingsRow> = {};
  if (patch.soundsEnabled !== undefined) row.sounds_enabled = patch.soundsEnabled;
  if (patch.remindersEnabled !== undefined) row.reminders_enabled = patch.remindersEnabled;
  if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
  if (patch.focusSound !== undefined) row.focus_sound = patch.focusSound;
  const { error } = await client().from('user_settings').update(row).eq('owner_id', ownerId);
  if (error) throw error;
}

export async function saveDisplayName(ownerId: string, name: string): Promise<void> {
  const { error } = await client()
    .from('profiles')
    .update({ display_name: name })
    .eq('id', ownerId);
  if (error) throw error;
}
