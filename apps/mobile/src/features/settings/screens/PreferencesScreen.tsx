import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import type { ThemePreference } from '../../../core/preferences/preferences';
import type { LanguagePreference } from '@habitzen/i18n/locales';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { Sheet } from '../../../shared/ui/Sheet';

export function PreferencesScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState(section === 'theme' ? 'theme' : 'language');
  const { t } = useTranslation('common');
  const { t: settings } = useTranslation('settings');
  const { preferences, setLanguage, setTheme, theme, persistenceError } = useAppPreferences();
  const languages: readonly { value: LanguagePreference; label: string; detail: string }[] = [
    { value: 'system', label: t('system'), detail: settings('system_language_hint') },
    { value: 'ru', label: t('ru'), detail: 'Русский' },
    { value: 'uk', label: t('uk'), detail: 'Українська' },
    { value: 'en', label: t('en'), detail: 'English' },
  ];
  const themes: readonly { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'light', label: settings('light'), icon: 'sun' },
    { value: 'dark', label: settings('dark'), icon: 'moon' },
    { value: 'system', label: settings('system'), icon: 'system' },
  ];
  return (
    <Sheet testID="preferences-sheet">
      <View style={{ alignItems: 'center', gap: 7 }}>
        <Icon name={tab === 'language' ? 'globe' : 'leaf'} size={35} color={theme.primary} />
        <AppText variant="title" style={styles.center}>
          {tab === 'language' ? settings('language') : settings('theme')}
        </AppText>
        <AppText style={[styles.center, { color: theme.textMuted, fontSize: 13, lineHeight: 21 }]}>
          {tab === 'language' ? settings('language_hint') : settings('theme_hint')}
        </AppText>
      </View>
      <View
        style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}
        accessibilityRole="tablist"
      >
        {(['language', 'theme'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            aria-selected={tab === key}
            testID={'preferences-tab-' + key}
            style={[styles.tab, tab === key ? { backgroundColor: theme.surface } : null]}
          >
            <AppText variant="button" style={{ fontSize: 13 }}>
              {key === 'language' ? t('language') : t('appearance')}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {tab === 'language'
          ? languages.map((language) => (
              <Pressable
                key={language.value}
                accessibilityRole="radio"
                aria-checked={preferences.language === language.value}
                onPress={() => setLanguage(language.value)}
                testID={'language-option-' + language.value}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      preferences.language === language.value ? theme.surfaceMuted : 'transparent',
                    borderColor: theme.border,
                  },
                ]}
              >
                <AppText variant="button" style={{ flex: 1 }}>
                  {language.label}
                </AppText>
                {preferences.language === language.value ? (
                  <Icon name="check" size={21} color={theme.primary} />
                ) : (
                  <View style={styles.emptyCircle} />
                )}
              </Pressable>
            ))
          : themes.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={preferences.theme === option.value}
                onPress={() => setTheme(option.value)}
                testID={'theme-option-' + option.value}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      preferences.theme === option.value ? theme.surfaceMuted : 'transparent',
                    borderColor: theme.border,
                  },
                ]}
              >
                <Icon name={option.icon} color={theme.primary} size={22} />
                <AppText variant="button" style={{ flex: 1 }}>
                  {option.label}
                </AppText>
                {preferences.theme === option.value ? (
                  <Icon name="check" size={21} color={theme.primary} />
                ) : (
                  <View style={styles.emptyCircle} />
                )}
              </Pressable>
            ))}
      </View>
      <AppText
        variant="small"
        style={[
          styles.center,
          { color: persistenceError ? theme.error : theme.textMuted, paddingBottom: 4 },
        ]}
      >
        {persistenceError ? settings('preference_save_error') : settings('preferences_saved_hint')}
      </AppText>
    </Sheet>
  );
}
const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  tabs: { flexDirection: 'row', borderRadius: 17, padding: 4 },
  tab: { flex: 1, minHeight: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  option: {
    minHeight: 59,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  emptyCircle: {
    width: 17,
    height: 17,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8A9E88',
    opacity: 0.5,
  },
});
