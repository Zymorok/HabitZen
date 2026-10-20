import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTranslator } from '@habitzen/i18n/translator';
import { resolveLocale } from '@habitzen/i18n/locales';
import type { LanguagePreference } from '@habitzen/i18n/locales';
import { palettes } from '@habitzen/design/tokens';
import type { AccentKey, Palette, ThemeColors } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { getLocales, useLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, AppState, useColorScheme, View } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as SystemUI from 'expo-system-ui';
import { defaultPreferences, parsePreferences } from '../preferences/preferences';
import type { AppPreferences, ThemePreference } from '../preferences/preferences';
import { mobileLogger } from '../diagnostics/mobile-logger';
import { useMotionPolicy } from '../../shared/motion/useMotionPolicy';

interface PreferencesContext {
  readonly preferences: AppPreferences;
  readonly theme: ThemeColors;
  /** Палитра выбранной цветовой темы: дневные и ночные цвета для плавной смены дня и ночи. */
  readonly palette: Palette;
  readonly isDark: boolean;
  /** 0 — день, 1 — ночь. Плавно меняется при смене темы, по нему анимируются небо, свет и цвета. */
  readonly night: SharedValue<number>;
  readonly persistenceError: boolean;
  setLanguage(language: LanguagePreference): void;
  setTheme(theme: ThemePreference): void;
  setReducedMotion(value: boolean): void;
  setHaptics(value: boolean): void;
  setAccent(value: AccentKey): void;
}
const Context = createContext<PreferencesContext | null>(null);
const PREFERENCES_KEY = 'habitzen.preferences.v1';
const translatorReady = createTranslator('en');

export function AppPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const systemTheme = useColorScheme();
  const deviceLocales = useLocales();
  const deviceLanguages = deviceLocales.map((locale) => locale.languageTag).join('|');
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [translator, setTranslator] = useState<Awaited<ReturnType<typeof createTranslator>> | null>(
    null,
  );
  const [persistenceError, setPersistenceError] = useState(false);
  const writeTail = useRef<Promise<void>>(Promise.resolve());
  const isDark =
    (preferences?.theme ?? 'system') === 'system'
      ? systemTheme === 'dark'
      : preferences?.theme === 'dark';
  const palette = palettes[preferences?.accent ?? 'forest'];
  const theme = isDark ? palette.dark : palette.light;
  const { reducedMotion } = useMotionPolicy();
  const night = useSharedValue(isDark ? 1 : 0);
  const themeSettled = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const instance = await translatorReady;
      let initial = defaultPreferences;
      try {
        initial = parsePreferences(await AsyncStorage.getItem(PREFERENCES_KEY));
      } catch {
        if (active) setPersistenceError(true);
        void mobileLogger.emit('warning', 'data', 'preferences.read_failed');
      }
      await instance.instance.changeLanguage(
        resolveLocale(
          initial.language,
          getLocales().map((item) => item.languageTag),
        ),
      );
      if (active) {
        setPreferences(initial);
        setTranslator(instance);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const changeLanguage = useCallback((language: LanguagePreference) => {
    setPreferences((current) => ({ ...(current ?? defaultPreferences), language }));
  }, []);
  const changeTheme = useCallback((nextTheme: ThemePreference) => {
    setPreferences((current) => ({ ...(current ?? defaultPreferences), theme: nextTheme }));
  }, []);
  const changeReducedMotion = useCallback((value: boolean) => {
    setPreferences((current) => ({ ...(current ?? defaultPreferences), reducedMotion: value }));
  }, []);
  const changeHaptics = useCallback((value: boolean) => {
    setPreferences((current) => ({ ...(current ?? defaultPreferences), haptics: value }));
  }, []);
  const changeAccent = useCallback((value: AccentKey) => {
    setPreferences((current) => ({ ...(current ?? defaultPreferences), accent: value }));
  }, []);

  useEffect(() => {
    if (!preferences || !translator) return;
    const nextLanguage = resolveLocale(preferences.language, deviceLanguages.split('|'));
    void translator.instance.changeLanguage(nextLanguage);
    // NOTE: Записи идут последовательно: быстрый выбор ru→uk→en не сохраняет старый язык последним.
    const snapshot = JSON.stringify(preferences);
    writeTail.current = writeTail.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(PREFERENCES_KEY, snapshot))
      .then(() => {
        setPersistenceError(false);
      })
      .catch(() => {
        setPersistenceError(true);
        void mobileLogger.emit('warning', 'data', 'preferences.write_failed');
      });
  }, [preferences, translator, deviceLanguages]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && preferences?.language === 'system' && translator) {
        void translator.instance.changeLanguage(
          resolveLocale(
            'system',
            getLocales().map((item) => item.languageTag),
          ),
        );
      }
    });
    return () => subscription.remove();
  }, [preferences?.language, translator]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background).catch(() => undefined);
  }, [theme.background]);

  useEffect(() => {
    const target = isDark ? 1 : 0;
    // NOTE: Пока настройки читаются с диска, тема ещё «системная». Первое значение после
    // загрузки ставится сразу, иначе при запуске с тёмной темой каждый раз был бы закат.
    if (!preferences || !themeSettled.current || reducedMotion || preferences.reducedMotion) {
      night.value = target;
      themeSettled.current = Boolean(preferences);
      return;
    }
    night.value = withTiming(target, {
      duration: motion.themeTransitionMs,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [isDark, preferences, reducedMotion, night]);

  if (!preferences || !translator) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  return (
    <I18nextProvider i18n={translator.instance}>
      <Context.Provider
        value={{
          preferences,
          theme,
          palette,
          isDark,
          night,
          persistenceError,
          setLanguage: changeLanguage,
          setTheme: changeTheme,
          setReducedMotion: changeReducedMotion,
          setHaptics: changeHaptics,
          setAccent: changeAccent,
        }}
      >
        {children}
      </Context.Provider>
    </I18nextProvider>
  );
}

/** Настройки, если провайдер уже есть выше по дереву; иначе null (например, внутри самого провайдера). */
export function useOptionalPreferences(): PreferencesContext | null {
  return useContext(Context);
}

export function useAppPreferences(): PreferencesContext {
  const value = useContext(Context);
  if (!value) throw new Error('Контекст оформления не подключён.');
  return value;
}
