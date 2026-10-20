import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { useHaptics } from '../../../shared/haptics';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { habitColor, habitIcon } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { usePlanCommand, usePlanProgress, useTodayPlan } from '../data/usePlan';
import { goalOfText, goalStep, isCountGoal } from '../../habits/goal';
import { NumberStepper } from '../../habits/components/FormControls';
import { RowMenu } from '../../../shared/ui/RowMenu';
import { StackTabBar } from '../../../navigation/TabBar';
import { openFocusFor } from '../../../navigation/reset-to';

import leafGreen from '../../../../assets/onboarding/leaf_green.webp';
import leafOrange from '../../../../assets/onboarding/leaf_orange.webp';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 236;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;

/**
 * Кадр 04: удержание 1,2 с. Кольцо наполняется, телефон отзывается каждые 200 мс;
 * отпустил раньше — кольцо откатывается и жест отменяется. Отметка засчитывается
 * только после ответа сервера, затем — кадр 05.
 * NOTE: У привычки с количеством кольцо уже заполнено на набранную долю, снизу — «− 3 стакана +»,
 * а удержание засчитывает всю цель сразу.
 */
export function HoldScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['habits', 'errors', 'common', 'progress']);
  const { theme, night, palette } = useAppPreferences();
  const haptics = useHaptics();
  const plan = useTodayPlan();
  const command = usePlanCommand();
  const amounts = usePlanProgress();
  const item = plan.data?.find((entry) => entry.itemId === itemId);
  const count = item ? isCountGoal(item.target, item.goalUnit) : false;
  const share = item && count ? Math.min(1, item.progress / item.target) : 0;
  const hold = useSharedValue(0);
  // NOTE: Набранная доля цели: «3 из 8» — кольцо заполнено на 38 % ещё до удержания.
  const base = useSharedValue(share);
  const [percent, setPercent] = useState(0);
  const [hint, setHint] = useState<'idle' | 'short' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestId = useRef(newRequestId());
  const color = item ? habitColor(item.colorKey) : theme.primary;

  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };
  useEffect(() => stopTicker, []);
  useEffect(() => {
    base.value = withTiming(share, { duration: 320 });
  }, [share, base]);

  const complete = useCallback(() => {
    stopTicker();
    if (!item) return;
    setHint('saving');
    setError(null);
    haptics.success();
    command.mutate(
      { command: 'complete', item, requestId: requestId.current },
      {
        onSuccess: () => router.replace({ pathname: '/done', params: { itemId: item.itemId } }),
        onError: (failure) => {
          setHint('idle');
          setError(t(errorMessageKey(failure)));
          hold.value = withTiming(0, { duration: 300 });
        },
      },
    );
  }, [item, command, router, t, hold]);

  useAnimatedReaction(
    () => Math.round((base.value + (1 - base.value) * hold.value) * 100),
    (value, previous) => {
      if (value !== previous) runOnJS(setPercent)(value);
    },
  );

  const pressIn = () => {
    if (!item || item.status !== 'pending' || command.isPending) return;
    setHint('idle');
    setError(null);
    cancelAnimation(hold);
    hold.value = withTiming(
      1,
      // WARNING: 1,2 с — правило жеста, а не украшение. При «Уменьшении движения» Reanimated
      // проигрывает анимацию мгновенно, и касание сразу засчитывалось бы как удержание.
      {
        duration: motion.holdToCompleteMs,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished) runOnJS(complete)();
      },
    );
    // NOTE: Лёгкая вибрация каждые 200 мс — человек чувствует, что жест идёт.
    stopTicker();
    if (haptics.enabled) {
      ticker.current = setInterval(() => haptics.light(), motion.holdHapticIntervalMs);
    }
  };
  const pressOut = () => {
    stopTicker();
    if (hold.value >= 1 || command.isPending) return;
    cancelAnimation(hold);
    if (hold.value > 0.02) setHint('short');
    hold.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) });
  };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: LENGTH * (1 - (base.value + (1 - base.value) * hold.value)),
  }));
  const trackProps = useAnimatedProps(() => ({
    stroke: interpolateColor(night.value, [0, 1], ['#E4ECD9', '#2E4A3B']),
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - hold.value * 0.04 }] }));
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));

  if (!item) {
    return (
      <View style={[styles.shell, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  const done = item.status === 'completed';
  const resting = item.status === 'skipped';

  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="hold-screen"
    >
      <FloatingLeaves />
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="hold-back"
        >
          <View style={styles.backIcon}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="button" style={styles.headerTitle} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <IconButton
          accessibilityLabel={t('habits:menu')}
          onPress={() => setMenu(true)}
          testID="hold-menu"
        >
          <Icon name="more" color={theme.text} />
        </IconButton>
      </View>

      <View style={styles.center}>
        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={done || resting}
          accessibilityRole="button"
          accessibilityLabel={t('habits:hold')}
          accessibilityHint={t('habits:hold_hint')}
          // NOTE: Экранный диктор не может «удерживать» — двойное касание сразу отмечает привычку.
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={() => complete()}
          testID="hold-target"
        >
          <Animated.View style={[styles.ring, pressStyle]}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                strokeWidth={STROKE}
                fill="none"
                animatedProps={trackProps}
              />
              {done ? (
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  strokeWidth={STROKE}
                  fill="none"
                  stroke={theme.success}
                />
              ) : (
                <AnimatedCircle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  strokeWidth={STROKE}
                  fill="none"
                  stroke={color}
                  strokeLinecap="round"
                  strokeDasharray={`${LENGTH} ${LENGTH}`}
                  animatedProps={ringProps}
                  // NOTE: Кольцо наполняется от верхней точки, как на макете.
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              )}
            </Svg>
            <Icon
              name={done ? 'check' : habitIcon(item.iconKey)}
              size={56}
              color={done ? theme.success : color}
              strokeWidth={1.6}
            />
            <AppText style={[styles.percent, { color: theme.text }]} testID="hold-percent">
              {done ? '100%' : `${percent}%`}
            </AppText>
          </Animated.View>
        </Pressable>

        <ThemedText variant="title" style={styles.title} testID="hold-title">
          {done
            ? t('habits:completed')
            : resting
              ? t('habits:skipped')
              : count
                ? t('habits:progress_of', {
                    done: item.progress,
                    goal: goalOfText(t, i18n.language, item.target, item.goalUnit),
                  })
                : t('habits:hold')}
        </ThemedText>
        {count && !resting ? (
          <View style={styles.actions}>
            <NumberStepper
              value={item.progress}
              label={t(`habits:unit_word_${item.goalUnit}`, { count: item.progress })}
              min={0}
              max={item.target * 10}
              step={goalStep(item.goalUnit)}
              onChange={(value) =>
                amounts.add(item, value - item.progress, () =>
                  router.replace({ pathname: '/done', params: { itemId: item.itemId } }),
                )
              }
              testID="hold-amount"
            />
          </View>
        ) : null}

        {done || resting ? (
          <View style={styles.actions}>
            <Button
              label={done ? t('habits:undo') : t('habits:back_to_plan')}
              variant="outline"
              onPress={() =>
                command.mutate(
                  { command: 'undo', item, requestId: newRequestId() },
                  { onError: (failure) => setError(t(errorMessageKey(failure))) },
                )
              }
              testID="hold-undo"
            />
          </View>
        ) : (
          <>
            {/* NOTE: У количества место пальца занимает счётчик — подсказка остаётся текстом. */}
            {count ? null : <Finger hold={hold} />}
            <ThemedText tone="textMuted" variant="small" testID="hold-hint">
              {hint === 'saving'
                ? t('habits:saving')
                : hint === 'short'
                  ? t('habits:hold_short')
                  : count
                    ? t('habits:hold_count_hint')
                    : t('habits:hold_hint')}
            </ThemedText>
          </>
        )}
        {hint === 'saving' ? <ActivityIndicator color={theme.primary} /> : null}
        {error || amounts.error ? (
          <AppText
            variant="small"
            style={{ color: theme.error, textAlign: 'center' }}
            testID="hold-error"
          >
            {error ?? t(errorMessageKey(amounts.error))}
          </AppText>
        ) : null}
      </View>

      <RowMenu
        title={item.title}
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          ...(resting
            ? []
            : [
                {
                  key: 'focus',
                  label: t('habits:focus_for'),
                  icon: 'clock' as const,
                  onPress: () => openFocusFor(router, item.habitId),
                },
              ]),
          {
            key: 'stats',
            label: t('progress:habit_stats'),
            icon: 'chart',
            onPress: () =>
              router.push({
                pathname: '/habit/stats/[habitId]',
                params: { habitId: item.habitId },
              }),
          },
          ...(item.status === 'pending'
            ? [
                {
                  key: 'skip',
                  label: t('habits:skipped'),
                  icon: 'moon' as const,
                  onPress: () =>
                    command.mutate(
                      { command: 'skip', item, requestId: newRequestId() },
                      {
                        onSuccess: () => router.back(),
                        onError: (failure) => setError(t(errorMessageKey(failure))),
                      },
                    ),
                },
              ]
            : []),
        ]}
      />
      {/* NOTE: Нижнее меню, как на кадре 04 макета. */}
      <StackTabBar active="today" />
    </Animated.View>
  );
}

/** Палец с расходящимися кругами: подсказка «держи здесь». */
function Finger({ hold }: { readonly hold: { value: number } }) {
  const { theme } = useAppPreferences();
  const { animate } = useMotionPolicy();
  const wave = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    wave.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [animate, wave]);
  const waveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(wave.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(wave.value, [0, 1], [0.6, 1.5]) }],
  }));
  const fingerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hold.value * 4 }] }));
  return (
    <View style={styles.finger} pointerEvents="none">
      <Animated.View style={[styles.wave, { borderColor: theme.primary }, waveStyle]} />
      <Animated.View style={fingerStyle}>
        <Icon name="hand" size={38} color={theme.primary} strokeWidth={1.6} />
      </Animated.View>
    </View>
  );
}

/** Несколько листьев медленно кружат на фоне, как на макете. */
function FloatingLeaves() {
  const { animate } = useMotionPolicy();
  const cycle = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    cycle.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [animate, cycle]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {(
        [
          { left: '12%', top: '16%', source: leafGreen, phase: 0, size: 22 },
          { left: '82%', top: '22%', source: leafOrange, phase: 1, size: 18 },
          { left: '8%', top: '58%', source: leafOrange, phase: 2, size: 16 },
          { left: '86%', top: '64%', source: leafGreen, phase: 3, size: 20 },
        ] as const
      ).map((leaf) => (
        <Leaf key={leaf.phase} {...leaf} cycle={cycle} />
      ))}
    </View>
  );
}

function Leaf({
  left,
  top,
  source,
  phase,
  size,
  cycle,
}: {
  readonly left: `${number}%`;
  readonly top: `${number}%`;
  readonly source: ImageSourcePropType;
  readonly phase: number;
  readonly size: number;
  readonly cycle: { value: number };
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(cycle.value * Math.PI * 2 + phase) * 10 },
      { rotate: `${Math.sin(cycle.value * Math.PI * 2 + phase) * 30 + phase * 40}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left, top, width: size, height: size, opacity: 0.85 }, style]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  backIcon: { transform: [{ scaleX: -1 }] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', gap: 6 },
  percent: { fontFamily: 'Manrope_600SemiBold', fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  title: { textAlign: 'center', fontSize: 22, lineHeight: 30, maxWidth: 280 },
  actions: { alignSelf: 'stretch', gap: 10 },
  finger: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 2 },
});
