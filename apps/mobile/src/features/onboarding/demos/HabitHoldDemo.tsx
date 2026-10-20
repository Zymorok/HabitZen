import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useWorld } from '../world/WorldContext';
import { DemoCard } from './DemoCard';
import type { Translate } from './DemoCard';

const ROWS: readonly { readonly key: string; readonly icon: IconName }[] = [
  { key: 'demo_water', icon: 'drop' },
  { key: 'demo_reading', icon: 'book' },
  { key: 'demo_walk', icon: 'walk' },
];

/**
 * Страница 2: как отмечается привычка. «Палец» удерживает кружок, он наполняется
 * за 1,2 секунды, появляется галочка — и соответствующий росток на грядке подрастает.
 */
export function HabitHoldDemo({ t, active }: { readonly t: Translate; readonly active: boolean }) {
  const { gardenGrowth, animate } = useWorld();
  const done = [useSharedValue(1), useSharedValue(0), useSharedValue(0)] as const;
  const hold = [useSharedValue(0), useSharedValue(0), useSharedValue(0)] as const;
  const finger = useSharedValue(0);
  const fingerRow = useSharedValue(1);

  useEffect(() => {
    gardenGrowth[0].value = 1;
    const finish = () => {
      done[1].value = 1;
      done[2].value = 1;
      gardenGrowth[1].value = 1;
      gardenGrowth[2].value = 1;
    };
    if (!active || !animate) {
      finish();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, action: () => void) => timers.push(setTimeout(action, ms));
    const pressRow = (row: 1 | 2, start: number) => {
      at(start, () => {
        fingerRow.value = row;
        finger.value = withTiming(1, { duration: 260 });
        hold[row].value = withTiming(1, {
          duration: motion.holdToCompleteMs,
          easing: Easing.inOut(Easing.quad),
        });
      });
      at(start + motion.holdToCompleteMs + 40, () => {
        done[row].value = withSequence(
          withSpring(1.18, motion.spring),
          withSpring(1, motion.spring),
        );
        gardenGrowth[row].value = withSpring(1, { damping: 9, stiffness: 90 });
        finger.value = withTiming(0, { duration: 260 });
      });
    };
    const cycle = () => {
      timers.length = 0;
      done[1].value = withTiming(0, { duration: 300 });
      done[2].value = withTiming(0, { duration: 300 });
      hold[1].value = 0;
      hold[2].value = 0;
      gardenGrowth[1].value = withTiming(0, { duration: 600 });
      gardenGrowth[2].value = withTiming(0, { duration: 600 });
      pressRow(1, 900);
      pressRow(2, 900 + motion.holdToCompleteMs + 1500);
      at(900 + (motion.holdToCompleteMs + 1500) * 2 + 2400, cycle);
    };
    cycle();
    return () => {
      timers.forEach(clearTimeout);
      [...done, ...hold, finger].forEach((value) => cancelAnimation(value));
    };
    // NOTE: Общие значения стабильны между рендерами, перезапуск нужен только при смене active/animate.
  }, [active, animate]);

  return (
    <DemoCard style={styles.card} testID="demo-habits">
      {ROWS.map((row, index) => (
        <HabitRow
          key={row.key}
          label={t(row.key)}
          icon={row.icon}
          done={done[index]!}
          hold={hold[index]!}
          finger={finger}
          fingerRow={fingerRow}
          index={index}
          last={index === ROWS.length - 1}
          holdLabel={t('demo_hold')}
        />
      ))}
    </DemoCard>
  );
}

function HabitRow({
  label,
  icon,
  done,
  hold,
  finger,
  fingerRow,
  index,
  last,
  holdLabel,
}: {
  readonly label: string;
  readonly icon: IconName;
  readonly done: SharedValue<number>;
  readonly hold: SharedValue<number>;
  readonly finger: SharedValue<number>;
  readonly fingerRow: SharedValue<number>;
  readonly index: number;
  readonly last: boolean;
  readonly holdLabel: string;
}) {
  const { night, theme, palette } = useAppPreferences();
  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.min(1, done.value),
      [0, 1],
      [
        'rgba(169,199,163,0)',
        night.value > 0.5 ? 'rgba(154,205,154,0.12)' : 'rgba(59,128,86,0.08)',
      ],
    ),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(hold.value * 0.92, Math.min(1, done.value)) }],
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.success, palette.dark.success],
    ),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, done.value),
    transform: [{ scale: done.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.primarySoft, palette.dark.primarySoft],
    ),
  }));
  const fingerStyle = useAnimatedStyle(() => {
    const shown = fingerRow.value === index ? finger.value : 0;
    return {
      opacity: shown,
      transform: [{ scale: 1.25 - shown * 0.25 - hold.value * 0.08 }],
    };
  });
  const hintStyle = useAnimatedStyle(() => ({
    opacity: fingerRow.value === index ? finger.value * (1 - Math.min(1, done.value)) : 0,
  }));
  return (
    <Animated.View style={[styles.row, !last ? styles.rowGap : null, rowStyle]}>
      <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
        <Icon name={icon} size={17} color={theme.primary} />
      </View>
      <ThemedText style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
      <Animated.Text style={[styles.hint, { color: theme.textMuted }, hintStyle]} numberOfLines={1}>
        {holdLabel}
      </Animated.Text>
      <Animated.View style={[styles.ring, ringStyle]}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, checkStyle]}>
          <Icon name="check" size={15} color="#FFFDF3" strokeWidth={2.4} />
        </Animated.View>
        {/* NOTE: «Палец» — полупрозрачный круг, который давит на кнопку, пока она наполняется. */}
        <Animated.View pointerEvents="none" style={[styles.finger, fingerStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const RING = 28;
const styles = StyleSheet.create({
  card: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  rowGap: { marginBottom: 2 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_500Medium' },
  hint: { fontSize: 11, fontFamily: 'Manrope_500Medium' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', width: RING - 2, height: RING - 2, borderRadius: RING },
  center: { alignItems: 'center', justifyContent: 'center' },
  finger: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(120,150,120,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
