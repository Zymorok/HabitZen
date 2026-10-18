import { createInstance } from 'i18next';
import { catalogs } from './catalogs.ts';
import type { SupportedLocale } from './locales.ts';

export type TranslationNamespace = keyof typeof catalogs.ru;
type TranslationKey<N extends TranslationNamespace> = keyof (typeof catalogs.ru)[N] & string;

export async function createTranslator(language: SupportedLocale) {
  // NOTE: Экземпляр создаётся один раз на контекст приложения, а не при каждом рендере или запросе.
  const instance = createInstance();
  await instance.init({
    lng: language,
    fallbackLng: 'en',
    resources: catalogs,
    defaultNS: 'common',
    keySeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  });
  return {
    instance,
    t<N extends TranslationNamespace>(
      namespace: N,
      key: TranslationKey<N>,
      values: Readonly<Record<string, string | number>> = {},
    ): string {
      return String(instance.t(key, { ...values, ns: namespace }));
    },
  };
}
