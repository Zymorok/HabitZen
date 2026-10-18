import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingPalette {
  readonly track: string;
  readonly from: string;
  readonly to: string;
  readonly glow: string;
}

/**
 * Кольцо таймера (кадры 06–07): тёмная дуга — оставшееся время, светлая — прошедшее.
 * NOTE: Пока таймер идёт, дуга убывает одной плавной анимацией до срока окончания,
 * а не скачками раз в секунду. Срок — с сервера, поэтому кольцо и цифры не расходятся.
 * WARNING: ReduceMotion.Never — кольцо показывает время, а не украшает экран; при
 * «Уменьшении движения» оно иначе сразу опустело бы.
 */
export function FocusRing({
  size,
  stroke,
  share,
  runningMs,
  palette,
  id,
  children,
}: {
  readonly size: number;
  readonly stroke: number;
  /** Доля оставшегося времени сейчас: 1 — полное кольцо. */
  readonly share: number;
  /** Сколько ещё идёт таймер; null — стоит (ожидание или пауза). */
  readonly runningMs: number | null;
  readonly palette: RingPalette;
  /** Уникальный id градиентов: на одном экране может быть два кольца при смене фазы. */
  readonly id: string;
  readonly children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const progress = useSharedValue(share);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = share;
    if (runningMs !== null && runningMs > 0) {
      progress.value = withTiming(0, {
        duration: runningMs,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      });
    }
  }, [share, runningMs, progress]);

  // NOTE: Дуга начинается в точке «прошедшего» времени и идёт по часовой до верха кольца.
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: -(1 - progress.value) * length,
    opacity: progress.value > 0.001 ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.from} />
            <Stop offset="1" stopColor={palette.to} />
          </LinearGradient>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor={palette.glow} stopOpacity={0.95} />
            <Stop offset="0.75" stopColor={palette.glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius - stroke / 2} fill={`url(#${id}-glow)`} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.track}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${id}-arc)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          animatedProps={arcProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
