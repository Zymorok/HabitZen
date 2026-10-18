import { parseLanguagePreference } from '@habitzen/i18n/locales';
import type { LanguagePreference } from '@habitzen/i18n/locales';

export type ThemePreference = 'system' | 'light' | 'dark';
export interface AppPreferences {
  readonly version: 1;
  readonly theme: ThemePreference;
  readonly language: LanguagePreference;
}
export const defaultPreferences: AppPreferences = {
  version: 1,
  theme: 'system',
  language: 'system',
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
    };
  } catch {
    // NOTE: Повреждённая настройка оформления не должна мешать открыть приложение.
    return defaultPreferences;
  }
}
