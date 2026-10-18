import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useWorld } from '../world/WorldContext';
import { DemoCard } from './DemoCard';
import type { Translate } from './DemoCard';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 132;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;
// NOTE: Сколько секунд показывать фокус и перерыв, прежде чем переключить режим.
const MODE_SECONDS = 8;

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Страница 3: таймер 25/5. Кольцо убывает, время тикает по-настоящему,
 * затем режим меняется на перерыв — кольцо становится персиковым.
 */
export function FocusTimerDemo({ t, active }: { readonly t: Translate; readonly active: boolean }) {
  const { night } = useAppPreferences();
  const { animate } = useWorld();
  const [{ mode, seconds }, setClock] = useState<{ mode: 'focus' | 'break'; seconds: number }>({
    mode: 'focus',
    seconds: 24 * 60 + 38,
  });
  const progress = useSharedValue(0.985);
  const breakMode = useSharedValue(0);

  useEffect(() => {
    if (!active || !animate) return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      setClock((clock) => {
        if (tick % MODE_SECONDS !== 0) return { ...clock, seconds: Math.max(0, clock.seconds - 1) };
        return clock.mode === 'focus'
          ? { mode: 'break', seconds: 5 * 60 }
          : { mode: 'focus', seconds: 24 * 60 + 38 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, animate]);

  useEffect(() => {
    const total = mode === 'focus' ? 25 * 60 : 5 * 60;
    progress.value = withTiming(seconds / total, {
      duration: 900,
      easing: Easing.out(Easing.quad),
    });
    breakMode.value = withTiming(mode === 'break' ? 1 : 0, { duration: 600 });
  }, [mode, seconds, progress, breakMode]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: LENGTH * (1 - progress.value),
    stroke: interpolateColor(
      breakMode.value,
      [0, 1],
      [
        interpolateColor(night.value, [0, 1], [lightTheme.primary, darkTheme.primary]),
        interpolateColor(night.value, [0, 1], ['#E98A55', '#F3B483']),
      ],
    ),
  }));
  const trackProps = useAnimatedProps(() => ({
    stroke: interpolateColor(night.value, [0, 1], ['#E2EAD7', '#2E4A3B']),
  }));
  const chipFocus = useChipStyle(breakMode, false);
  const chipBreak = useChipStyle(breakMode, true);

  return (
    <View style={styles.wrap} testID="demo-focus">
      <DemoCard style={styles.dial}>
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
            animatedProps={trackProps}
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${LENGTH} ${LENGTH}`}
            animatedProps={ringProps}
            // NOTE: Кольцо начинается сверху, как на циферблате.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <Icon
            name={mode === 'focus' ? 'leaf' : 'pause'}
            size={18}
            color={mode === 'focus' ? '#5B8C63' : '#E98A55'}
          />
          <ThemedText style={styles.time}>{format(seconds)}</ThemedText>
          <ThemedText tone="textMuted" variant="small">
            {t(mode === 'focus' ? 'demo_focus' : 'demo_break')}
          </ThemedText>
        </View>
      </DemoCard>
      <View style={styles.chips}>
        <Animated.View style={[styles.chip, chipFocus]}>
          <ThemedText variant="small" style={styles.chipText}>
            {`${t('demo_focus')} · ${t('demo_minutes', { count: 25 })}`}
          </ThemedText>
        </Animated.View>
        <Animated.View style={[styles.chip, chipBreak]}>
          <ThemedText variant="small" style={styles.chipText}>
            {`${t('demo_break')} · ${t('demo_minutes', { count: 5 })}`}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

function useChipStyle(breakMode: SharedValue<number>, forBreak: boolean) {
  const { night } = useAppPreferences();
  return useAnimatedStyle(() => {
    const on = forBreak ? breakMode.value : 1 - breakMode.value;
    const color = forBreak ? 'rgba(243,161,106,0.30)' : 'rgba(91,140,99,0.26)';
    return {
      backgroundColor: interpolateColor(
        on,
        [0, 1],
        [night.value > 0.5 ? 'rgba(32,54,44,0.85)' : 'rgba(255,252,244,0.85)', color],
      ),
      transform: [{ scale: 0.94 + on * 0.06 }],
    };
  });
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  dial: {
    width: SIZE + 24,
    height: SIZE + 24,
    borderRadius: (SIZE + 24) / 2,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: { position: 'absolute', left: 11, top: 11 },
  center: { alignItems: 'center' },
  time: { fontFamily: 'Manrope_600SemiBold', fontSize: 28, lineHeight: 36, letterSpacing: -1 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
  chipText: { fontFamily: 'Manrope_500Medium' },
});
