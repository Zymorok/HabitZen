import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useWorld } from '../world/WorldContext';
import { DemoCard } from './DemoCard';
import type { Translate } from './DemoCard';

/**
 * Страница 4: дни недели отмечаются по одному, серия растёт, полоска уровня наполняется.
 * На седьмой день — новый уровень, и дерево на холме вырастает из саженца.
 */
export function ProgressDemo({ t, active }: { readonly t: Translate; readonly active: boolean }) {
  const { treeGrowth, animate } = useWorld();
  const [days, setDays] = useState(7);
  const [level, setLevel] = useState(4);
  const bar = useSharedValue(1);
  const levelPop = useSharedValue(1);

  useEffect(() => {
    if (!active || !animate) {
      setDays(7);
      setLevel(4);
      bar.value = 1;
      treeGrowth.value = 1;
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, action: () => void) => timers.push(setTimeout(action, ms));
    const cycle = () => {
      timers.length = 0;
      setDays(0);
      setLevel(3);
      bar.value = withTiming(0.15, { duration: 500 });
      treeGrowth.value = withTiming(0.12, { duration: 700 });
      for (let day = 1; day <= 7; day++) {
        at(700 + day * 620, () => {
          setDays(day);
          bar.value = withTiming(0.15 + (day / 7) * 0.85, { duration: 450 });
          // NOTE: Саженец понемногу подрастает каждый день, а на седьмой превращается в дерево.
          treeGrowth.value = withTiming(day < 7 ? 0.12 + day * 0.04 : 1, {
            duration: day < 7 ? 450 : motion.treeGrowthMs * 2,
          });
        });
      }
      at(700 + 7 * 620 + 500, () => {
        setLevel(4);
        levelPop.value = withSequence(
          withSpring(1.25, motion.spring),
          withSpring(1, motion.spring),
        );
      });
      at(700 + 7 * 620 + 6500, cycle);
    };
    cycle();
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimation(bar);
    };
    // NOTE: Общие значения стабильны; перезапуск только при смене active/animate.
  }, [active, animate, bar, levelPop, treeGrowth]);

  const weekdays = t('demo_weekdays').split(',');
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const levelStyle = useAnimatedStyle(() => ({ transform: [{ scale: levelPop.value }] }));
  return (
    <DemoCard style={styles.card} testID="demo-progress">
      <View style={styles.header}>
        <Animated.View style={levelStyle}>
          <ThemedText variant="title" style={styles.level}>
            {t('demo_level', { level })}
          </ThemedText>
        </Animated.View>
        <View style={styles.streak}>
          <Icon name="flame" size={15} color="#E98A55" />
          <ThemedText variant="small" style={styles.streakText}>
            {t('demo_streak', { count: Math.max(days, 1) })}
          </ThemedText>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
      <View style={styles.week}>
        {weekdays.map((name, index) => (
          <Day key={name} name={name} done={index < days} />
        ))}
      </View>
    </DemoCard>
  );
}

function Day({ name, done }: { readonly name: string; readonly done: boolean }) {
  const { night } = useAppPreferences();
  const value = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    value.value = done ? withSpring(1, motion.spring) : withTiming(0, { duration: 250 });
  }, [done, value]);
  return <DayView name={name} value={value} night={night} />;
}

function DayView({
  name,
  value,
  night,
}: {
  readonly name: string;
  readonly value: SharedValue<number>;
  readonly night: SharedValue<number>;
}) {
  const circle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.min(1, value.value),
      [0, 1],
      [
        interpolateColor(night.value, [0, 1], ['#E8EEDC', '#2A4335']),
        interpolateColor(night.value, [0, 1], [lightTheme.success, darkTheme.success]),
      ],
    ),
    transform: [{ scale: 0.86 + value.value * 0.14 }],
  }));
  const check = useAnimatedStyle(() => ({ opacity: Math.min(1, value.value) }));
  return (
    <View style={styles.day}>
      <Animated.View style={[styles.dayCircle, circle]}>
        <Animated.View style={check}>
          <Icon name="check" size={12} color="#FFFDF3" strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
      <ThemedText variant="small" tone="textMuted" style={styles.dayName}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: { fontSize: 19, lineHeight: 26 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(243,161,106,0.18)',
  },
  streakText: { fontFamily: 'Manrope_600SemiBold' },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(169,199,163,0.35)',
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: 4, backgroundColor: '#5B8C63' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 3 },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: { fontSize: 10, lineHeight: 13 },
});
