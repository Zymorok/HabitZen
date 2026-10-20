import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  clockText,
  phaseDurationMs,
  remainingMs,
  remainingShare,
  resetTimer,
} from '@habitzen/core/timer';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { focusAudio } from '../../../platform/audio/focus-audio';
import { cancelFocusAlert, scheduleFocusAlert } from '../../../platform/focus-alert/focus-alert';
import { useHaptics } from '../../../shared/haptics';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { RowMenu } from '../../../shared/ui/RowMenu';
import type { MenuAction } from '../../../shared/ui/RowMenu';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { FOCUS_SOUNDS, timerStateOf } from '../data/focus-api';
import type { FocusCommand, FocusSound } from '../data/focus-api';
import { useFocusCommand, useFocusSound, useFocusState, useSaveFocusSound } from '../data/useFocus';
import { BreathCircle, useBreath } from '../components/BreathCircle';
import { FocusRing } from '../components/FocusRing';
import type { RingPalette } from '../components/FocusRing';
import { useSecondTick } from '../useSecondTick';
import { HabitChip } from '../components/HabitChip';
import { useRefreshPlan, useTodayPlan } from '../../today/data/usePlan';
import { habitIcon } from '../../../shared/habit-look';

import focusScene from '../../../../assets/focus/focus_scene.webp';
import breakScene from '../../../../assets/focus/break_scene.webp';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DOTS = 5;
const PANEL_FOCUS = 132;
const PANEL_BREAK = 150;
const ARCH = 34;
const BIG_BUTTON = 84;

// NOTE: Кольцо фокуса — в цвете темы (HZ-09, токены palette.ring); перерыв всегда персиковый.
const BREAK_RING: { day: RingPalette; night: RingPalette } = {
  day: { track: '#F8DCC6', from: '#F6B184', to: '#E57F4C', glow: '#FFF6EC' },
  night: { track: '#4A3428', from: '#F6C29C', to: '#E9976A', glow: '#2E231D' },
};

/**
 * Кадры 06–07: таймер фокуса 25 минут и перерыв 5 минут с дыханием.
 * NOTE: Время считает сервер по сроку окончания. Экран лишь показывает остаток и
 * перечитывает состояние при возвращении в приложение, поэтому сворачивание, перезапуск
 * и второе устройство не сбивают таймер.
 * NOTE: С HZ-08 фокус можно засчитать в привычку: минуты — в цель «20 минут»,
 * а полное занятие отмечает привычку «просто отметить».
 */
export function FocusScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation(['focus', 'errors', 'common', 'notifications']);
  const { theme, night, isDark, palette } = useAppPreferences();
  const { foreground } = useMotionPolicy();
  const haptics = useHaptics();
  const focus = useFocusState();
  const command = useFocusCommand();
  const sound = useFocusSound();
  const saveSound = useSaveFocusSound();
  const [menu, setMenu] = useState<'none' | 'more' | 'sound' | 'habit'>('none');
  const params = useLocalSearchParams<{ habitId?: string }>();
  const [chosenHabit, setChosenHabit] = useState<string | null>(params.habitId ?? null);
  // NOTE: «Фокус для привычки» из плана открывает этот экран уже с выбранной привычкой.
  useEffect(() => {
    if (params.habitId) setChosenHabit(params.habitId);
  }, [params.habitId]);
  const plan = useTodayPlan();
  const refreshPlan = useRefreshPlan();
  const [error, setError] = useState<string | null>(null);

  const snapshot = focus.data;
  const timer = useMemo(
    () => (snapshot ? timerStateOf(snapshot) : resetTimer('focus')),
    [snapshot],
  );
  const session = snapshot?.session ?? null;
  const running = timer.status === 'running';
  const sessionHabit = session && session.status !== 'reset' ? session.habitId : null;
  const now = useSecondTick(running && foreground, running ? timer.deadlineMs : null);
  const left = remainingMs(timer, now);
  const isBreak = timer.phase === 'break';
  const soundChoice: FocusSound = sound.data ?? 'none';
  // NOTE: Кольцо пересчитывается при смене состояния, а не каждую секунду: дальше оно
  // плавно убывает само до срока окончания.
  const ring = useMemo(() => {
    const at = Date.now();
    return {
      share: remainingShare(timer, at),
      runningMs: timer.status === 'running' ? remainingMs(timer, at) : null,
    };
  }, [timer]);

  // NOTE: Возвращение в приложение — повод сверить таймер с сервером.
  const { refetch } = focus;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  // NOTE: Время вышло на экране — сервер фиксирует итог по сроку; спрашиваем, пока не ответит.
  const finishedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!running || left > 0 || !session) return;
    if (finishedFor.current !== session.id) {
      finishedFor.current = session.id;
      haptics.success();
    }
    void refetch();
    const retry = setInterval(() => void refetch(), 1500);
    return () => clearInterval(retry);
  }, [running, left, session, refetch, haptics]);

  // NOTE: Звук играет только во время идущего фокуса и пока приложение на экране.
  const playing = running && !isBreak && left > 0 && foreground && soundChoice !== 'none';
  useEffect(() => {
    if (playing) void focusAudio.play(soundChoice);
    else void focusAudio.stop();
  }, [playing, soundChoice]);
  useEffect(() => () => void focusAudio.stop(), []);

  // NOTE: Уведомление о конце — на случай, если приложение свёрнуто; пауза и сброс его снимают.
  useEffect(() => {
    if (!snapshot) return;
    if (timer.status === 'running')
      void scheduleFocusAlert(timer.deadlineMs, {
        title: t(
          timer.phase === 'focus' ? 'notifications:focus_title' : 'notifications:break_title',
        ),
        body: t(timer.phase === 'focus' ? 'notifications:focus_body' : 'notifications:break_body'),
        channelName: t('notifications:focus_channel'),
      });
    else void cancelFocusAlert();
  }, [snapshot, timer, t]);

  // NOTE: Засчитанное занятие меняет план, календарь и дерево — перечитываем их.
  const counted = `${snapshot?.completedToday ?? 0}:${snapshot?.minutesToday ?? 0}`;
  const lastCounted = useRef(counted);
  useEffect(() => {
    if (lastCounted.current === counted) return;
    lastCounted.current = counted;
    void refreshPlan();
  }, [counted, refreshPlan]);

  const run = (next: FocusCommand) => {
    setError(null);
    command.mutate(
      { command: next, requestId: newRequestId() },
      { onError: (failure) => setError(t(errorMessageKey(failure))) },
    );
  };

  const breakShown = useSharedValue(isBreak ? 1 : 0);
  useEffect(() => {
    breakShown.value = withTiming(isBreak ? 1 : 0, { duration: 700 });
  }, [isBreak, breakShown]);
  const breakSceneStyle = useAnimatedStyle(() => ({ opacity: breakShown.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: night.value * 0.62 }));
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const archProps = useAnimatedProps(() => ({
    fill: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));

  const breath = useBreath(isBreak && timer.status !== 'paused');
  const panel = isBreak ? PANEL_BREAK : PANEL_FOCUS;
  const tabBar = 64 + Math.max(insets.bottom, 8);
  // NOTE: Пилюля привычки под заголовком фокуса занимает ещё ~40 точек.
  const header = Math.max(insets.top, 14) + 96;
  const ringSize = Math.round(
    Math.max(220, Math.min(320, width - 72, height - tabBar - header - panel - 70)),
  );
  // NOTE: Пейзаж заканчивается под дугой панели — ниже его закрывает кремовая панель.
  const sceneHeight = Math.max(height - tabBar - panel + 4, ringSize + header);
  const ringPalette = (isBreak ? BREAK_RING : palette.ring)[isDark ? 'night' : 'day'];
  const active = session !== null && (session.status === 'running' || session.status === 'paused');
  const filledDots = Math.min(DOTS, (snapshot?.completedToday ?? 0) + (active && !isBreak ? 1 : 0));
  const soundLabel = t(soundChoice === 'none' ? 'focus:sound_none' : `focus:${soundChoice}`);
  const planItems = (plan.data ?? []).filter((item) => item.status !== 'skipped');
  const shownHabitId = active ? sessionHabit : chosenHabit;
  const shownHabit = planItems.find((item) => item.habitId === shownHabitId) ?? null;

  if (focus.isPending) {
    return (
      <View style={[styles.shell, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (focus.isError) {
    return (
      <View
        style={[styles.shell, styles.center, { backgroundColor: theme.background, padding: 24 }]}
      >
        <AppText style={{ color: theme.error, textAlign: 'center' }} testID="focus-error">
          {t(errorMessageKey(focus.error))}
        </AppText>
        <Button label={t('common:retry')} variant="outline" onPress={() => void refetch()} />
      </View>
    );
  }

  const moreActions: MenuAction[] = [
    ...(active && session
      ? [
          {
            key: 'finish',
            label: t('focus:finish'),
            icon: 'check' as IconName,
            onPress: () => run({ kind: 'finish', session }),
          },
          {
            key: 'reset',
            label: t('focus:reset'),
            icon: 'reset' as IconName,
            onPress: () => run({ kind: 'reset', session }),
          },
        ]
      : []),
    {
      key: 'sound',
      label: t('focus:sound_title'),
      icon: soundChoice === 'none' ? 'soundOff' : 'sound',
      onPress: () => setTimeout(() => setMenu('sound'), 250),
    },
  ];
  const habitActions: MenuAction[] = [
    {
      key: 'habit-none',
      label: t('focus:habit_none'),
      icon: 'leaf',
      selected: shownHabit === null,
      onPress: () => setChosenHabit(null),
    },
    ...planItems.map((item) => ({
      key: `habit-${item.habitId}`,
      label: item.title,
      icon: habitIcon(item.iconKey),
      selected: item.habitId === shownHabit?.habitId,
      onPress: () => setChosenHabit(item.habitId),
    })),
  ];
  const soundActions: MenuAction[] = FOCUS_SOUNDS.map((choice) => ({
    key: `sound-${choice}`,
    label: t(choice === 'none' ? 'focus:sound_none' : `focus:${choice}`),
    icon: choice === 'none' ? 'soundOff' : 'sound',
    selected: choice === soundChoice,
    onPress: () => saveSound.mutate(choice),
  }));

  const mainAction = (): void => {
    if (!session || !active)
      run({ kind: 'start', phase: timer.phase, habitId: shownHabit?.habitId ?? null });
    else if (session.status === 'running') run({ kind: 'pause', session });
    else run({ kind: 'resume', session });
  };
  const timeColor = isBreak ? (isDark ? '#F3C29F' : '#8A4A2A') : theme.text;

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="focus-screen">
      <View style={[styles.scene, { height: sceneHeight }]} pointerEvents="none">
        <Image
          source={focusScene}
          style={{ width, height: sceneHeight }}
          resizeMode="cover"
          accessible={false}
        />
        <Animated.View style={[StyleSheet.absoluteFill, breakSceneStyle]}>
          <Image
            source={breakScene}
            style={{ width, height: sceneHeight }}
            resizeMode="cover"
            accessible={false}
          />
        </Animated.View>
        {/* NOTE: Ночью пейзаж приглушается тем же тёмным слоем, что и мир первого запуска. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
        <LinearGradient
          colors={[isDark ? 'rgba(20,35,30,0.55)' : 'rgba(251,248,239,0.75)', 'rgba(0,0,0,0)']}
          style={[styles.topFade, { height: header + 20 }]}
        />
      </View>

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        {isBreak ? (
          <Animated.View entering={FadeIn.duration(500)} style={styles.breakHeader}>
            <ThemedText variant="title" style={styles.breakTitle} testID="focus-title">
              {t('focus:rest_title')}
            </ThemedText>
            <ThemedText tone="textMuted" style={styles.breakSubtitle}>
              {t('focus:break_minutes')}
            </ThemedText>
          </Animated.View>
        ) : (
          <View style={styles.focusHeader}>
            <IconButton
              accessibilityLabel={t('focus:sound_title')}
              onPress={() => setMenu('sound')}
              testID="focus-menu"
            >
              <Icon name="menu" color={theme.text} />
            </IconButton>
            <ThemedText variant="title" style={styles.focusTitle} testID="focus-title">
              {t('focus:screen_title')}
            </ThemedText>
            <IconButton
              accessibilityLabel={t('focus:more')}
              onPress={() => setMenu('more')}
              testID="focus-more"
            >
              <Icon name="more" color={theme.text} />
            </IconButton>
          </View>
        )}
        {!isBreak && (planItems.length > 0 || shownHabit) ? (
          <HabitChip
            title={shownHabit?.title ?? null}
            iconKey={shownHabit?.iconKey ?? null}
            locked={active}
            onPress={() => setMenu('habit')}
          />
        ) : null}
      </View>

      <View style={styles.ringArea}>
        <Animated.View
          key={timer.phase}
          entering={FadeIn.duration(500)}
          accessibilityRole="timer"
          accessibilityLabel={t('focus:time_left', { time: clockText(left) })}
          testID="focus-ring"
        >
          <FocusRing
            size={ringSize}
            stroke={ringSize > 260 ? 15 : 13}
            share={ring.share}
            runningMs={ring.runningMs}
            palette={ringPalette}
            id={`ring-${timer.phase}`}
          >
            {isBreak ? (
              <BreathCircle size={breath.size} color={isDark ? '#5A3E2E' : '#FDE3CF'} />
            ) : null}
            <Icon
              name={isBreak ? 'leaf' : 'sprout'}
              size={isBreak ? 36 : 44}
              color={isBreak ? '#EE9563' : isDark ? ringPalette.from : ringPalette.to}
              fill={isBreak ? '#F6B184' : isDark ? ringPalette.to : ringPalette.from}
              strokeWidth={1.6}
            />
            <AppText
              style={[styles.time, { color: timeColor, fontSize: ringSize > 260 ? 62 : 52 }]}
              maxFontSizeMultiplier={1.1}
              testID="focus-time"
            >
              {clockText(left)}
            </AppText>
            <AppText
              style={[styles.caption, { color: isBreak ? timeColor : theme.textMuted }]}
              maxFontSizeMultiplier={1.3}
              testID="focus-caption"
            >
              {isBreak
                ? t(breath.inhale ? 'focus:inhale' : 'focus:exhale')
                : timer.status === 'paused'
                  ? t('focus:paused_caption')
                  : t('focus:focus_caption', { minutes: phaseDurationMs.focus / 60000 })}
            </AppText>
          </FocusRing>
        </Animated.View>
      </View>

      <Animated.View style={[styles.panel, { height: panel }, panelStyle]}>
        <Svg width={width} height={ARCH} style={styles.arch} pointerEvents="none">
          <AnimatedPath
            d={`M0 ${ARCH} L0 ${ARCH - 8} Q ${width / 2} ${-ARCH + 10} ${width} ${ARCH - 8} L${width} ${ARCH} Z`}
            animatedProps={archProps}
          />
        </Svg>
        {isBreak ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.breakActions}>
            <Button
              tone="peach"
              label={
                !active
                  ? t('focus:start_break')
                  : session?.status === 'running'
                    ? t('focus:pause')
                    : t('focus:resume')
              }
              onPress={mainAction}
              disabled={command.isPending}
              testID="focus-main"
            />
            <Button
              tone="peach"
              variant="outline"
              label={t('focus:skip_break')}
              onPress={() =>
                active && session ? run({ kind: 'finish', session }) : run({ kind: 'skip_break' })
              }
              disabled={command.isPending}
              testID="focus-skip"
            />
          </Animated.View>
        ) : (
          <View style={styles.focusActions}>
            <RoundButton
              icon={running ? 'pause' : 'play'}
              label={running ? t('focus:pause') : active ? t('focus:resume') : t('focus:start')}
              onPress={mainAction}
              busy={command.isPending}
            />
            <View style={styles.sideRow}>
              <SideButton
                icon={soundChoice === 'none' ? 'soundOff' : 'sound'}
                label={soundLabel}
                onPress={() => setMenu('sound')}
                testID="focus-sound"
              />
              <SideButton
                icon="reset"
                label={t('focus:reset_short')}
                disabled={!active || command.isPending}
                onPress={() => {
                  if (active && session) run({ kind: 'reset', session });
                }}
                testID="focus-reset"
              />
            </View>
            <View
              style={styles.dots}
              accessible
              // NOTE: Точки — картинка с подписью для читалки экрана: «Сегодня завершено 2 занятия».
              accessibilityRole="image"
              accessibilityLabel={t('focus:sessions_today', {
                count: snapshot?.completedToday ?? 0,
              })}
              testID="focus-dots"
            >
              {Array.from({ length: DOTS }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    { borderColor: theme.primarySoft },
                    index < filledDots
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : null,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
        {error ? (
          <AppText
            variant="small"
            style={[styles.error, { color: theme.error }]}
            testID="focus-action-error"
          >
            {error}
          </AppText>
        ) : null}
      </Animated.View>

      <RowMenu
        title={
          menu === 'sound'
            ? t('focus:today_summary', {
                count: snapshot?.completedToday ?? 0,
                minutes: snapshot?.minutesToday ?? 0,
              })
            : menu === 'habit'
              ? t('focus:habit_pick')
              : t('focus:screen_title')
        }
        visible={menu !== 'none'}
        actions={menu === 'sound' ? soundActions : menu === 'habit' ? habitActions : moreActions}
        onClose={() => setMenu('none')}
      />
    </Animated.View>
  );
}

/** Большая круглая кнопка запуска и паузы: пружинит при нажатии, как на макете. */
function RoundButton({
  icon,
  label,
  onPress,
  busy,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly busy: boolean;
}) {
  const haptics = useHaptics();
  const { palette } = useAppPreferences();
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.07 }],
  }));
  return (
    <Animated.View style={[styles.round, style]}>
      <Pressable
        onPress={busy ? undefined : onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, motion.pressSpring);
          haptics.medium();
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { ...motion.pressSpring, damping: 9 });
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy }}
        testID="focus-main"
        style={styles.roundTouch}
      >
        {/* NOTE: Кнопка в цвете темы (HZ-09); тёмный дневной градиент — белый значок читается и ночью. */}
        <LinearGradient
          colors={[palette.gradient.day[0], palette.gradient.day[1]]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {busy ? (
          <ActivityIndicator color="#FFFDF3" />
        ) : (
          <View style={icon === 'play' ? styles.playNudge : null}>
            <Icon name={icon} size={34} color="#FFFDF3" strokeWidth={icon === 'pause' ? 3.4 : 2} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SideButton({
  icon,
  label,
  onPress,
  disabled = false,
  testID,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
  }));
  const color = disabled ? theme.border : theme.textMuted;
  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          pressed.value = withSpring(1, motion.pressSpring);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, motion.pressSpring);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        testID={testID}
        style={styles.side}
      >
        <Icon name={icon} size={28} color={disabled ? theme.border : theme.text} />
        <AppText style={[styles.sideLabel, { color }]} numberOfLines={1}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  scene: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  dim: { backgroundColor: '#0B1712' },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  header: { paddingHorizontal: 10 },
  focusHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  focusTitle: { flex: 1, textAlign: 'center', fontSize: 22, lineHeight: 30 },
  breakHeader: { alignItems: 'center', paddingTop: 14, gap: 2 },
  // WARNING: Центрированные подписи растянуты на всю ширину: на Android строка «по размеру
  // текста» с этим шрифтом измеряется чуть уже и последнее слово обрезается.
  breakTitle: { fontSize: 30, lineHeight: 40, textAlign: 'center', alignSelf: 'stretch' },
  breakSubtitle: { fontSize: 17, textAlign: 'center', alignSelf: 'stretch' },
  ringArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  time: {
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -1,
    lineHeight: 76,
    fontVariant: ['tabular-nums'],
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  caption: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    marginTop: -4,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  panel: { justifyContent: 'flex-start' },
  arch: { position: 'absolute', top: -ARCH + 1, left: 0 },
  focusActions: { alignItems: 'center', marginTop: -BIG_BUTTON / 2 - 6 },
  round: {
    width: BIG_BUTTON,
    height: BIG_BUTTON,
    borderRadius: BIG_BUTTON / 2,
    boxShadow: '0 12px 24px rgba(29,70,48,0.35)',
  },
  roundTouch: {
    flex: 1,
    borderRadius: BIG_BUTTON / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNudge: { marginLeft: 4 },
  sideRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: -24,
  },
  side: { alignItems: 'center', gap: 6, minWidth: 96, minHeight: 64, justifyContent: 'center' },
  sideLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5 },
  breakActions: { paddingHorizontal: 22, gap: 12, paddingTop: 8 },
  error: { textAlign: 'center', marginTop: 8, paddingHorizontal: 22 },
});
