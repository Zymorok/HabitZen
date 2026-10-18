export const supportedLocales = ['ru', 'uk', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type LanguagePreference = SupportedLocale | 'system';

export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): SupportedLocale {
  if (preference !== 'system') return preference;
  for (const tag of deviceLanguages) {
    const language = tag.toLowerCase().split(/[-_]/)[0];
    if (supportedLocales.includes(language as SupportedLocale)) return language as SupportedLocale;
  }
  return 'en';
}

export function parseLanguagePreference(value: unknown): LanguagePreference {
  if (value === 'system' || supportedLocales.includes(value as SupportedLocale)) {
    return value as LanguagePreference;
  }
  return 'system';
}
