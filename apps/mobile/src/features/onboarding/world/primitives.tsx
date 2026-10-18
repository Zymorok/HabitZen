import { Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { useId } from 'react';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useWorld } from './WorldContext';
import { swayAngle } from './geometry';

export interface ArtImage {
  readonly source: ImageSourcePropType;
  readonly width: number;
  readonly height: number;
}

// NOTE: Цвет ночного «затемнения» и лунной кромки. Луна стоит слева вверху,
// поэтому светлая кромка ложится на левый верхний край предметов.
const NIGHT_TINT = '#0A1824';
const MOON_RIM = '#CFE2F2';

/** Слой, который едет при перелистывании со своей скоростью. */
export function ParallaxLayer({
  factor,
  children,
  testID,
}: {
  readonly factor: number;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const { scrollX } = useWorld();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value * factor }],
  }));
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Картинка мира с ночным светом. Днём показывается как есть. Ночью поверх ложится
 * тёмно-синяя копия того же силуэта, а сзади — светлая лунная кромка.
 * Если для слоя нарисован отдельный ночной вариант, он плавно проявляется вместо затемнения.
 */
export function Sprite({
  art,
  nightArt,
  left,
  top,
  width,
  rim = true,
  shade = 0.58,
  style,
  testID,
  children,
}: {
  readonly art: ArtImage;
  readonly nightArt?: ArtImage;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly rim?: boolean;
  /** Насколько темнеет предмет ночью, 0…1. */
  readonly shade?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly children?: ReactNode;
}) {
  const { night } = useWorld();
  const height = (width * art.height) / art.width;
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value * (nightArt ? 1 : shade) }));
  const rimStyle = useAnimatedStyle(() => ({ opacity: night.value * 0.5 }));
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      style={[{ position: 'absolute', left, top, width, height }, style]}
    >
      {rim && !nightArt ? (
        <Animated.Image
          source={art.source}
          fadeDuration={0}
          style={[styles.fill, styles.rim, { tintColor: MOON_RIM }, rimStyle]}
        />
      ) : null}
      <Image source={art.source} fadeDuration={0} style={styles.fill} />
      <Animated.Image
        source={nightArt ? nightArt.source : art.source}
        fadeDuration={0}
        style={[styles.fill, nightArt ? null : { tintColor: NIGHT_TINT }, nightStyle]}
      />
      {children}
    </Animated.View>
  );
}

/** Покачивание вокруг точки опоры: трава, листья, камыши, крона. */
export function Sway({
  amplitude,
  speed = 1.1,
  phase = 0,
  origin = '50% 100%',
  children,
  style,
  testID,
}: {
  readonly amplitude: number;
  readonly speed?: number;
  readonly phase?: number;
  readonly origin?: string;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const { time } = useWorld();
  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swayAngle(time.value, amplitude, speed, phase)}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      style={[StyleSheet.absoluteFill, { transformOrigin: origin }, style, animated]}
    >
      {children}
    </Animated.View>
  );
}

/** Мягкая тень под предметом. Днём солнце справа — тень влево, ночью луна слева — тень вправо. */
export function ContactShadow({
  centerX,
  y,
  width,
}: {
  readonly centerX: number;
  readonly y: number;
  readonly width: number;
}) {
  const { night } = useWorld();
  const style = useAnimatedStyle(() => ({
    opacity: 0.32 - night.value * 0.1,
    transform: [
      { translateX: (-0.09 + night.value * 0.16) * width },
      { scaleX: 1.08 - night.value * 0.12 },
    ],
  }));
  const id = useId().replace(/:/g, '');
  const height = width * 0.16;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: centerX - width / 2, top: y - height / 2, width, height },
        style,
      ]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={'shadow' + id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#24301C" stopOpacity="1" />
            <Stop offset="0.6" stopColor="#24301C" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#24301C" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#shadow${id})`}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  rim: { transform: [{ translateX: -1.5 }, { translateY: -1.5 }] },
});
