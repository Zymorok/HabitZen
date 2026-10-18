import { describe, expect, it } from 'vitest';
import { catalogs } from '../../packages/i18n/src/catalogs.ts';
import {
  formatCalendarDate,
  formatMonthTitle,
  formatPercent,
  weekdayLabels,
} from '../../packages/i18n/src/formatters.ts';
import {
  parseLanguagePreference,
  resolveLocale,
  supportedLocales,
} from '../../packages/i18n/src/locales.ts';
import { createTranslator } from '../../packages/i18n/src/translator.ts';
import { localDate } from '../../packages/core/src/calendar.ts';

const baseKey = (key: string) => key.replace(/_(one|few|many|other|zero|two)$/, '');
describe('Языки и полнота словарей', () => {
  it('использует выбранный язык независимо от системы', () => {
    expect(resolveLocale('uk', ['en-US'])).toBe('uk');
  });
  it('учитывает регион и следующий поддерживаемый язык устройства', () => {
    expect(resolveLocale('system', ['pl-PL', 'uk-UA'])).toBe('uk');
    expect(resolveLocale('system', ['ru_RU'])).toBe('ru');
  });
  it('предсказуемо обрабатывает неподдерживаемый язык и старые настройки', () => {
    expect(resolveLocale('system', ['pl-PL'])).toBe('en');
    expect(parseLanguagePreference('неизвестно')).toBe('system');
  });
  it.each(supportedLocales)('содержит одинаковые смысловые ключи и параметры для %s', (locale) => {
    for (const namespace of Object.keys(catalogs.ru) as (keyof typeof catalogs.ru)[]) {
      const reference = catalogs.ru[namespace];
      const translated = catalogs[locale][namespace];
      expect([...new Set(Object.keys(translated).map(baseKey))].sort()).toEqual(
        [...new Set(Object.keys(reference).map(baseKey))].sort(),
      );
      for (const [key, value] of Object.entries(translated)) {
        expect(value.trim()).not.toBe('');
        const source =
          (reference as Record<string, string>)[key] ??
          (reference as Record<string, string>)[baseKey(key)];
        const parameters = (text: string) =>
          [...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();
        expect(parameters(value)).toEqual(parameters(source ?? ''));
      }
    }
  });
  it('использует русские формы числительных', async () => {
    const { t } = await createTranslator('ru');
    expect(t('progress', 'streak_days', { count: 1 })).toBe('1 день подряд');
    expect(t('progress', 'streak_days', { count: 2 })).toBe('2 дня подряд');
    expect(t('progress', 'streak_days', { count: 5 })).toBe('5 дней подряд');
    expect(t('progress', 'streak_days', { count: 21 })).toBe('21 день подряд');
  });
  it('использует украинские формы числительных', async () => {
    const { t } = await createTranslator('uk');
    expect(t('progress', 'streak_days', { count: 1 })).toBe('1 день поспіль');
    expect(t('progress', 'streak_days', { count: 2 })).toBe('2 дні поспіль');
    expect(t('progress', 'streak_days', { count: 5 })).toBe('5 днів поспіль');
  });
  it('использует английские формы числительных', async () => {
    const { t } = await createTranslator('en');
    expect(t('progress', 'streak_days', { count: 1 })).toBe('1 day in a row');
    expect(t('progress', 'streak_days', { count: 2 })).toBe('2 days in a row');
  });
  it('меняет язык без создания нового приложения', async () => {
    const { instance, t } = await createTranslator('ru');
    expect(t('common', 'save')).toBe('Сохранить');
    await instance.changeLanguage('uk');
    expect(t('common', 'save')).toBe('Зберегти');
    expect(t('habits', 'title_label')).toBe('Назва звички');
  });
  it('форматирует календарь и проценты выбранным языком', () => {
    expect(formatCalendarDate(localDate('2026-10-17'), 'ru')).toContain('октября');
    expect(formatCalendarDate(localDate('2026-10-17'), 'uk')).toContain('жовтня');
    expect(formatCalendarDate(localDate('2026-10-17'), 'en')).toContain('October');
    expect(formatPercent(0.8, 'en')).toBe('80%');
  });
});

describe('Подписи календаря', () => {
  it('называет месяц в именительном падеже с заглавной буквы', () => {
    expect(formatMonthTitle(localDate('2026-10-17'), 'ru', false)).toBe('Октябрь');
    expect(formatMonthTitle(localDate('2026-10-17'), 'uk', false)).toBe('Жовтень');
    expect(formatMonthTitle(localDate('2025-12-01'), 'en', true)).toBe('December 2025');
  });
  it('начинает неделю с понедельника на всех языках', () => {
    expect(weekdayLabels('ru')).toEqual(['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']);
    expect(weekdayLabels('uk')[0]).toBe('ПН');
    expect(weekdayLabels('en')[6]).toBe('SUN');
  });
});
