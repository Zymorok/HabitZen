import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  LinearTransition,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useWorldClock } from '../../../shared/motion/useWorldClock';
import { World } from '../world/World';
import { WorldProvider } from '../world/WorldContext';
import type { WorldState } from '../world/WorldContext';
import { PAGE_COUNT } from '../world/geometry';
import { HabitHoldDemo } from '../demos/HabitHoldDemo';
import { FocusTimerDemo } from '../demos/FocusTimerDemo';
import { ProgressDemo } from '../demos/ProgressDemo';
import { ReminderDemo } from '../demos/ReminderDemo';
import type { Translate } from '../demos/DemoCard';

const pages = [
  { title: 'title', body: 'subtitle' },
  { title: 'habits_title', body: 'habits_body' },
  { title: 'focus_title', body: 'focus_body' },
  { title: 'growth_title', body: 'growth_body' },
  { title: 'reminders_title', body: 'reminders_body' },
] as const;

/**
 * Первый запуск: пять страниц поверх одного живого мира.
 * NOTE: Мир лежит под листалкой и едет вместе с ней с разной скоростью слоёв.
 */
export function OnboardingScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const width = Math.min(windowWidth, 480);
  const compact = windowHeight < 740;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { i18n, t: liveT } = useTranslation('onboarding');
  const { t: liveCommon } = useTranslation('common');
  const { isDark, night } = useAppPreferences();
  const { time, animate, reducedMotion } = useWorldClock();
  const [activePage, setActivePage] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const previousPage = useSharedValue(0);
  const [shellHeight, setShellHeight] = useState(windowHeight);
  const [footerTop, setFooterTop] = useState(windowHeight * 0.78);
  const gardenA = useSharedValue(1);
  const gardenB = useSharedValue(0);
  const gardenC = useSharedValue(0);
  const treeGrowth = useSharedValue(1);
  const howl = useSharedValue(0);

  // NOTE: Смена языка: текст уходит вверх и растворяется, затем проявляется новый.
  // Переводы берутся из «показанного» языка, чтобы не мелькнул новый текст до исчезновения старого.
  const [shownLanguage, setShownLanguage] = useState(i18n.language);
  const shownRef = useRef(i18n.language);
  const textFade = useSharedValue(1);
  useEffect(() => {
    const reveal = (language: string) => {
      shownRef.current = language;
      setShownLanguage(language);
      textFade.value = withTiming(1, { duration: motion.languageInMs });
    };
    const onChange = (language: string) => {
      // NOTE: При запуске язык «меняется» на тот же самый — исчезать тексту незачем.
      // Если человек быстро вернул прежний язык, начатое исчезновение отменяется.
      if (language === shownRef.current) {
        textFade.value = withTiming(1, { duration: motion.languageInMs });
        return;
      }
      if (reducedMotion) {
        reveal(language);
        return;
      }
      textFade.value = withTiming(0, { duration: motion.languageOutMs }, (finished) => {
        if (finished) runOnJS(reveal)(language);
      });
    };
    i18n.on('languageChanged', onChange);
    return () => i18n.off('languageChanged', onChange);
  }, [i18n, reducedMotion, textFade]);
  const t: Translate = useMemo(() => {
    const fixed = i18n.getFixedT(shownLanguage, 'onboarding');
    return (key, values) => String(values ? fixed(key, values) : fixed(key));
  }, [i18n, shownLanguage]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
    const next = Math.max(0, Math.min(PAGE_COUNT - 1, Math.round(event.contentOffset.x / width)));
    if (next !== previousPage.value) {
      previousPage.value = next;
      runOnJS(setActivePage)(next);
    }
  });
  const goTo = (page: number) => {
    setActivePage(page);
    scroll.current?.scrollTo({ x: page * width, animated: !reducedMotion });
    if (Platform.OS !== 'web' && !reducedMotion)
      void Haptics.selectionAsync().catch(() => undefined);
  };

  // NOTE: Земля — чуть выше кнопок: главные объекты страниц стоят прямо над ними.
  const groundY = footerTop - width * 0.1;
  const world: WorldState = useMemo(
    () => ({
      time,
      night,
      scrollX,
      width,
      height: shellHeight,
      groundY,
      animate,
      gardenGrowth: [gardenA, gardenB, gardenC],
      treeGrowth,
      howl,
    }),
    [
      time,
      night,
      scrollX,
      width,
      shellHeight,
      groundY,
      animate,
      gardenA,
      gardenB,
      gardenC,
      treeGrowth,
      howl,
    ],
  );

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));

  return (
    <WorldProvider value={world}>
      <Animated.View
        style={[styles.shell, shellStyle]}
        testID="onboarding-shell"
        onLayout={(event: LayoutChangeEvent) => setShellHeight(event.nativeEvent.layout.height)}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <World />
        <View style={[styles.toolbar, { paddingTop: Math.max(insets.top, 14) }]}>
          <IconButton
            onPress={() =>
              router.push({ pathname: '/preferences', params: { section: 'language' } })
            }
            testID="language-button"
            accessibilityLabel={liveCommon('language')}
          >
            <ThemedIcon light="globe" dark="globe" night={night} />
          </IconButton>
          <IconButton
            onPress={() => router.push({ pathname: '/preferences', params: { section: 'theme' } })}
            testID="theme-button"
            accessibilityLabel={liveCommon('appearance')}
          >
            <ThemedIcon light="sun" dark="moon" night={night} spin />
          </IconButton>
        </View>
        <View style={[styles.brand, { height: compact ? 70 : 86 }]}>
          <ThemedText variant="brand" style={{ fontSize: compact ? 42 : 48 }}>
            {liveCommon('app_name')}
          </ThemedText>
        </View>
        <Animated.ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.pager}
          testID="onboarding-pager"
          onLayout={() => {
            // NOTE: Поворот или изменение окна сохраняет выбранную страницу.
            scroll.current?.scrollTo({ x: activePage * width, animated: false });
          }}
        >
          {pages.map((page, index) => (
            <View
              key={page.title}
              style={[styles.page, { width }]}
              testID={'onboarding-page-' + index}
              aria-hidden={index !== activePage}
              importantForAccessibility={index === activePage ? 'auto' : 'no-hide-descendants'}
            >
              <PageCopy
                index={index}
                width={width}
                scrollX={scrollX}
                textFade={textFade}
                compact={compact}
                title={t(page.title)}
                body={t(page.body)}
              />
              <PageDemo index={index} width={width} scrollX={scrollX} textFade={textFade}>
                {index === 1 ? <HabitHoldDemo t={t} active={activePage === 1} /> : null}
                {index === 2 ? <FocusTimerDemo t={t} active={activePage === 2} /> : null}
                {index === 3 ? <ProgressDemo t={t} active={activePage === 3} /> : null}
                {index === 4 ? (
                  <>
                    <ReminderDemo t={t} active={activePage === 4} />
                    <Pressable
                      testID="reminders-button"
                      style={styles.remindersLink}
                      accessibilityRole="button"
                      onPress={() => router.push('/permissions')}
                    >
                      <Icon
                        name="bell"
                        size={16}
                        color={isDark ? darkTheme.primary : lightTheme.primary}
                      />
                      <ThemedText variant="button" tone="primary" style={styles.remindersText}>
                        {t('configure_reminders')}
                      </ThemedText>
                    </Pressable>
                  </>
                ) : null}
              </PageDemo>
            </View>
          ))}
        </Animated.ScrollView>
        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, compact ? 8 : 16) }]}
          onLayout={(event: LayoutChangeEvent) => setFooterTop(event.nativeEvent.layout.y)}
        >
          <Button
            label={liveT('start')}
            onPress={() => router.push('/auth/sign-up')}
            testID="start-button"
          />
          <Button
            label={liveT('have_account')}
            variant="outline"
            onPress={() => router.push('/auth/sign-in')}
            testID="account-button"
          />
          <View
            style={styles.pagination}
            accessibilityRole="tablist"
            accessibilityLabel={t('pages')}
          >
            {pages.map((page, index) => (
              <Pressable
                key={page.title}
                onPress={() => goTo(index)}
                accessibilityRole="tab"
                aria-selected={activePage === index}
                accessibilityLabel={t('page_label', { page: index + 1, total: pages.length })}
                testID={'page-dot-' + index}
                style={styles.dotTarget}
                hitSlop={4}
              >
                <Dot index={index} width={width} scrollX={scrollX} night={night} />
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>
    </WorldProvider>
  );
}

/**
 * Заголовок и текст страницы. При перелистывании отстают от страницы и бледнеют —
 * текст как будто висит на своей глубине. При смене языка — уходят вверх и возвращаются.
 */
function PageCopy({
  index,
  width,
  scrollX,
  textFade,
  compact,
  title,
  body,
}: {
  readonly index: number;
  readonly width: number;
  readonly scrollX: SharedValue<number>;
  readonly textFade: SharedValue<number>;
  readonly compact: boolean;
  readonly title: string;
  readonly body: string;
}) {
  const style = useAnimatedStyle(() => {
    const offset = scrollX.value - index * width;
    const distance = Math.min(1, Math.abs(offset) / width);
    // NOTE: Соседняя страница не просвечивает: текст полностью гаснет к 80% пути.
    return {
      opacity: Math.pow(Math.max(0, 1 - distance * 1.25), 1.2) * textFade.value,
      transform: [{ translateX: offset * 0.32 }, { translateY: (1 - textFade.value) * -10 }],
    };
  });
  return (
    <Animated.View
      layout={LinearTransition.duration(260)}
      style={[styles.copy, { paddingTop: compact ? 4 : 10, minHeight: compact ? 104 : 118 }, style]}
    >
      <ThemedText
        variant="title"
        style={[styles.heading, { fontSize: compact ? 23 : 25, lineHeight: compact ? 31 : 34 }]}
      >
        {title}
      </ThemedText>
      <ThemedText
        tone="textMuted"
        style={[styles.subtitle, { fontSize: compact ? 14 : 15, lineHeight: compact ? 21 : 23 }]}
      >
        {body}
      </ThemedText>
    </Animated.View>
  );
}

/** Живой пример под текстом: выезжает чуть быстрее страницы, как ближний план. */
function PageDemo({
  index,
  width,
  scrollX,
  textFade,
  children,
}: {
  readonly index: number;
  readonly width: number;
  readonly scrollX: SharedValue<number>;
  readonly textFade: SharedValue<number>;
  readonly children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const offset = scrollX.value - index * width;
    const distance = Math.min(1, Math.abs(offset) / width);
    return {
      opacity: Math.max(0, 1 - distance * 1.3) * (0.4 + textFade.value * 0.6),
      transform: [{ translateX: -offset * 0.12 }, { scale: 1 - distance * 0.06 }],
    };
  });
  return <Animated.View style={[styles.demo, style]}>{children}</Animated.View>;
}

/** Точка страницы: активная вытягивается в черту и плавно перетекает при перелистывании. */
function Dot({
  index,
  width,
  scrollX,
  night,
}: {
  readonly index: number;
  readonly width: number;
  readonly scrollX: SharedValue<number>;
  readonly night: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const closeness = Math.max(0, 1 - Math.abs(scrollX.value / width - index));
    const active = interpolateColor(night.value, [0, 1], [lightTheme.primary, darkTheme.primary]);
    const idle = interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.primarySoft, darkTheme.primarySoft],
    );
    return {
      width: interpolate(closeness, [0, 1], [6, 20]),
      backgroundColor: interpolateColor(closeness, [0, 1], [idle, active]),
      opacity: 0.6 + closeness * 0.4,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** Иконка с плавной сменой цвета (и формы — солнце превращается в луну). */
function ThemedIcon({
  light,
  dark,
  night,
  spin = false,
}: {
  readonly light: IconName;
  readonly dark: IconName;
  readonly night: SharedValue<number>;
  readonly spin?: boolean;
}) {
  const dayStyle = useAnimatedStyle(() => ({
    opacity: 1 - night.value,
    transform: [
      { rotate: `${spin ? night.value * 90 : 0}deg` },
      { scale: spin ? 1 - night.value * 0.4 : 1 },
    ],
  }));
  const nightStyle = useAnimatedStyle(() => ({
    opacity: night.value,
    transform: [
      { rotate: `${spin ? (night.value - 1) * 90 : 0}deg` },
      { scale: spin ? 0.6 + night.value * 0.4 : 1 },
    ],
  }));
  return (
    <View style={styles.iconStack}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, dayStyle]}>
        <Icon name={light} color={lightTheme.text} size={spin ? 26 : 23} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, nightStyle]}>
        <Icon name={dark} color={darkTheme.text} size={spin ? 24 : 23} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, overflow: 'hidden' },
  toolbar: {
    minHeight: 57,
    paddingHorizontal: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 5,
  },
  iconStack: { width: 28, height: 28 },
  iconCenter: { alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', justifyContent: 'center' },
  pager: { flex: 1 },
  page: { flex: 1 },
  copy: { paddingHorizontal: 28, alignItems: 'center', gap: 9 },
  heading: { textAlign: 'center', letterSpacing: -0.65 },
  subtitle: { maxWidth: 320, textAlign: 'center' },
  demo: { paddingHorizontal: 22, paddingTop: 8, gap: 8 },
  footer: { paddingHorizontal: 24, paddingTop: 5, gap: 10 },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginTop: 3 },
  dotTarget: { width: 26, height: 32, justifyContent: 'center', alignItems: 'center' },
  dot: { height: 6, borderRadius: 5 },
  remindersLink: {
    alignSelf: 'center',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  remindersText: { fontSize: 13 },
});
