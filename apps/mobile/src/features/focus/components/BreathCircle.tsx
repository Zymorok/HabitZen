import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';

const { from, to } = motion.breathDiameter;

/**
 * Дыхание на перерыве (HZ-R11): круг растёт 180→240 за 4 с («Вдох») и сжимается за 4 с («Выдох»).
 * NOTE: При «Уменьшении движения» круг не двигается, но подпись всё так же сменяется каждые 4 с —
 * ритм дыхания остаётся, исчезает только движение.
 */
export function useBreath(active: boolean) {
  const { animate, foreground } = useMotionPolicy();
  const [inhale, setInhale] = useState(true);
  const size = useSharedValue<number>(from);

  useEffect(() => {
    if (!active || !foreground) {
      cancelAnimation(size);
      return;
    }
    const duration = inhale ? motion.breathInMs : motion.breathOutMs;
    if (!animate) {
      size.value = inhale ? to : from;
      const timer = setTimeout(() => setInhale((value) => !value), duration);
      return () => clearTimeout(timer);
    }
    size.value = withTiming(
      inhale ? to : from,
      { duration, easing: Easing.inOut(Easing.sin) },
      (finished) => {
        if (finished) runOnJS(setInhale)(!inhale);
      },
    );
    return () => cancelAnimation(size);
  }, [active, foreground, animate, inhale, size]);

  useEffect(() => {
    if (active) return;
    setInhale(true);
    size.value = withTiming(from, { duration: 400 });
  }, [active, size]);

  return { inhale, size };
}

export function BreathCircle({
  size,
  color,
}: {
  readonly size: ReturnType<typeof useBreath>['size'];
  readonly color: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: size.value / to }],
    opacity: 0.35 + ((size.value - from) / (to - from)) * 0.35,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.circle, { backgroundColor: color }, style]}
      testID="breath-circle"
    />
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', width: to, height: to, borderRadius: to / 2 },
});
