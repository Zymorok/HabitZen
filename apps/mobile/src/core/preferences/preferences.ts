import { parseLanguagePreference } from '@habitzen/i18n/locales';
import type { LanguagePreference } from '@habitzen/i18n/locales';
import { ACCENTS } from '@habitzen/design/tokens';
import type { AccentKey } from '@habitzen/design/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
export interface AppPreferences {
  readonly version: 1;
  readonly theme: ThemePreference;
  readonly language: LanguagePreference;
  /** «Меньше движения» в приложении — вдобавок к системной настройке телефона. */
  readonly reducedMotion: boolean;
  /** Вибрация при удержании, нажатиях и наградах. */
  readonly haptics: boolean;
  /** Цветовая тема (HZ-08): «Лес», «Закат», «Океан», «Лаванда». */
  readonly accent: AccentKey;
}
export const defaultPreferences: AppPreferences = {
  version: 1,
  theme: 'system',
  language: 'system',
  reducedMotion: false,
  haptics: true,
  accent: 'forest',
};

export function parsePreferences(source: string | null): AppPreferences {
  if (!source) return defaultPreferences;
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) {
      return defaultPreferences;
    }
    const theme = 'theme' in value ? value.theme : undefined;
    return {
      version: 1,
      theme: theme === 'light' || theme === 'dark' ? theme : 'system',
      language: parseLanguagePreference('language' in value ? value.language : undefined),
      // NOTE: Сохранённые до HZ-07 настройки не знают этих полей — берутся значения по умолчанию.
      reducedMotion: 'reducedMotion' in value && value.reducedMotion === true,
      haptics: !('haptics' in value) || value.haptics !== false,
      // NOTE: Незнакомая тема (например, из будущей версии) превращается в исходный «Лес».
      accent: ACCENTS.find((key) => 'accent' in value && value.accent === key) ?? 'forest',
    };
  } catch {
    // NOTE: Повреждённая настройка оформления не должна мешать открыть приложение.
    return defaultPreferences;
  }
}
