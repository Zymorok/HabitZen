import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPolicy } from './useMotionPolicy';

import leafGreen from '../../../assets/onboarding/leaf_green.webp';
import leafOrange from '../../../assets/onboarding/leaf_orange.webp';

/** Листья падают сверху и кружатся — праздник без лишнего шума. */
export function LeafConfetti({
  count = 14,
  distance = 520,
}: {
  readonly count?: number;
  /** Сколько пикселей лист пролетает сверху вниз. */
  readonly distance?: number;
}) {
  const { animate } = useMotionPolicy();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        left: `${((index * 37) % 92) + 4}%` as const,
        delay: (index * 173) % 1400,
        size: 12 + ((index * 7) % 10),
        source: index % 3 === 0 ? leafGreen : leafOrange,
        drift: index % 2 ? 18 : -18,
      })),
    [count],
  );
  if (!animate) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="leaf-confetti">
      {pieces.map((piece, index) => (
        <FallingLeaf key={index} {...piece} distance={distance} />
      ))}
    </View>
  );
}

function FallingLeaf({
  left,
  delay,
  size,
  source,
  drift,
  distance,
}: {
  readonly left: `${number}%`;
  readonly delay: number;
  readonly size: number;
  readonly source: ImageSourcePropType;
  readonly drift: number;
  readonly distance: number;
}) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false),
    );
  }, [delay, fall]);
  const style = useAnimatedStyle(() => ({
    opacity: fall.value < 0.05 ? fall.value * 20 : 1 - Math.max(0, fall.value - 0.75) * 4,
    transform: [
      { translateY: -40 + fall.value * distance },
      { translateX: Math.sin(fall.value * Math.PI * 4) * drift },
      { rotate: `${fall.value * 540}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left, top: 0, width: size, height: size }, style]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}
