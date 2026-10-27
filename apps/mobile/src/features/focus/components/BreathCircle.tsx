import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';

const { from, to } = motion.breathDiameter;

/**
 * Дыхание на перерыве (HZ-R11): круг растёт 180→240 за 4 с («Вдох») и сжимается за 4 с («Выдох»).
 * Бесконечный цикл — withRepeat(withSequence(вдох, выдох), -1) с кривой Easing.inOut(Easing.ease),
 * как в задании (HZ-11). Подпись «Вдох/Выдох» следует за направлением круга.
 * NOTE: При «Уменьшении движения» круг не двигается, но подпись всё так же сменяется каждые 4 с —
 * ритм дыхания остаётся, исчезает только движение.
 */
export function useBreath(active: boolean) {
  const { animate, foreground } = useMotionPolicy();
  const [inhale, setInhale] = useState(true);
  const size = useSharedValue<number>(from);
  const growing = useSharedValue(true);
  const running = active && foreground;
  // NOTE: Когда перерыв на паузе, сжатие круга к началу не должно переключать подпись.
  const live = useSharedValue(running);
  useEffect(() => {
    live.value = running;
  }, [running, live]);

  useEffect(() => {
    if (!running) {
      cancelAnimation(size);
      return;
    }
    if (!animate) {
      // NOTE: Без движения подпись меняется по таймеру, круг стоит на месте.
      size.value = to;
      setInhale(true);
      const timer = setInterval(() => setInhale((value) => !value), motion.breathInMs);
      return () => clearInterval(timer);
    }
    const easing = Easing.inOut(Easing.ease);
    size.value = from;
    size.value = withRepeat(
      withSequence(
        withTiming(to, { duration: motion.breathInMs, easing }),
        withTiming(from, { duration: motion.breathOutMs, easing }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(size);
  }, [running, animate, size]);

  // NOTE: Направление круга определяет подпись: растёт — «Вдох», сжимается — «Выдох».
  useAnimatedReaction(
    () => size.value,
    (current, previous) => {
      if (!live.value || previous === null || current === previous) return;
      const up = current > previous;
      if (up !== growing.value) {
        growing.value = up;
        runOnJS(setInhale)(up);
      }
    },
  );

  useEffect(() => {
    if (active) return;
    setInhale(true);
    growing.value = true;
    size.value = withTiming(from, { duration: 400 });
  }, [active, size, growing]);

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
