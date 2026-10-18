import { StyleSheet } from 'react-native';
import { useMemo } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { art } from './art';
import { useWorld } from './WorldContext';
import { Sprite } from './primitives';
import type { ArtImage } from './primitives';
import { PAGE_COUNT, seededRandom, smoothstep } from './geometry';

/** Светлячки ночью: блуждают у земли и вспыхивают в своём ритме. */
export function Fireflies() {
  const { width, groundY } = useWorld();
  const flies = useMemo(() => {
    const random = seededRandom(31);
    return Array.from({ length: 16 }, () => ({
      x: random() * width * PAGE_COUNT,
      y: groundY - width * (0.04 + random() * 0.32),
      phase: random() * 10,
    }));
  }, [width, groundY]);
  return (
    <>
      {flies.map((fly) => (
        <Firefly key={fly.phase} {...fly} />
      ))}
    </>
  );
}

function Firefly({
  x,
  y,
  phase,
}: {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}) {
  const { time, night, width } = useWorld();
  const style = useAnimatedStyle(() => {
    const t = time.value;
    const blink = Math.max(0, Math.sin(t * 1.3 + phase));
    return {
      opacity: smoothstep(0.5, 1, night.value) * (0.15 + blink * 0.85),
      transform: [
        {
          translateX:
            x +
            Math.sin(t * 0.35 + phase) * width * 0.07 +
            Math.sin(t * 1.2 + phase) * width * 0.012,
        },
        { translateY: y + Math.cos(t * 0.29 + phase * 1.3) * width * 0.045 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.firefly, style]} />;
}

/** Днём в воздухе летают пушинки одуванчика. */
export function Seeds() {
  const { width, groundY } = useWorld();
  const seeds = useMemo(() => {
    const random = seededRandom(57);
    return Array.from({ length: 9 }, () => ({
      x: random() * width * PAGE_COUNT,
      y: groundY - width * (0.1 + random() * 0.45),
      phase: random() * 10,
      size: width * (0.022 + random() * 0.014),
    }));
  }, [width, groundY]);
  return (
    <>
      {seeds.map((seed) => (
        <Floating key={seed.phase} image={art.seed} {...seed} />
      ))}
    </>
  );
}

function Floating({
  image,
  x,
  y,
  phase,
  size,
}: {
  readonly image: ArtImage;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly size: number;
}) {
  const { time, night, width } = useWorld();
  const style = useAnimatedStyle(() => {
    const t = time.value;
    // NOTE: Пушинка медленно уплывает вправо-вверх и возвращается с другой стороны.
    const drift = ((t * 9 + phase * 40) % (width * 0.7)) - width * 0.35;
    return {
      opacity: (1 - smoothstep(0.2, 0.6, night.value)) * (0.55 + Math.sin(t * 0.8 + phase) * 0.25),
      transform: [
        { translateX: x + drift },
        { translateY: y - drift * 0.25 + Math.sin(t * 1.1 + phase) * width * 0.02 },
        { rotate: `${Math.sin(t * 0.9 + phase) * 25}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.absolute, style]}>
      <Sprite art={image} left={-size / 2} top={-size / 2} width={size} rim={false} />
    </Animated.View>
  );
}

const BUTTERFLIES = [
  { page: 0, x: 0.3, y: 0.3, image: 'butterfly1', phase: 0 },
  { page: 0, x: 0.7, y: 0.22, image: 'butterfly2', phase: 2.4 },
  { page: 1, x: 0.62, y: 0.26, image: 'butterfly1', phase: 4.1 },
  { page: 3, x: 0.25, y: 0.42, image: 'butterfly2', phase: 1.2 },
] as const;

/** Бабочки днём кружат у ростков. Взмах крыльев — сжатие по горизонтали. */
export function Butterflies() {
  const { width, groundY } = useWorld();
  return (
    <>
      {BUTTERFLIES.map((butterfly) => (
        <Butterfly
          key={butterfly.phase}
          image={art[butterfly.image]}
          x={(butterfly.page + butterfly.x) * width}
          y={groundY - butterfly.y * width}
          phase={butterfly.phase}
          size={width * 0.06}
        />
      ))}
    </>
  );
}

function Butterfly({
  image,
  x,
  y,
  phase,
  size,
}: {
  readonly image: ArtImage;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly size: number;
}) {
  const { time, night, width } = useWorld();
  const style = useAnimatedStyle(() => {
    const t = time.value;
    const dx = Math.sin(t * 0.45 + phase) * width * 0.12;
    const dy =
      Math.sin(t * 0.9 + phase * 1.7) * width * 0.05 + Math.sin(t * 3.1 + phase) * width * 0.008;
    return {
      opacity: 1 - smoothstep(0.15, 0.5, night.value),
      transform: [
        { translateX: x + dx },
        { translateY: y + dy },
        // NOTE: Летит влево — смотрит влево, вправо — вправо.
        { scaleX: Math.cos(t * 0.45 + phase) >= 0 ? 1 : -1 },
      ],
    };
  });
  const wings = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.25 + 0.75 * Math.abs(Math.sin(time.value * 13 + phase)) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.absolute, style]}>
      <Animated.View
        style={[
          { position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size },
          wings,
        ]}
      >
        <Sprite art={image} left={0} top={0} width={size} rim={false} />
      </Animated.View>
    </Animated.View>
  );
}

/** С дерева на странице 4 медленно падают листья — и днём, и ночью. */
export function FallingLeaves() {
  const { width, groundY } = useWorld();
  const leaves = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((index) => ({
        x: width * (3.28 + index * 0.11),
        top: groundY - width * 0.95,
        fall: width * 0.8,
        phase: index * 1.7,
        image: index % 2 ? art.leafOrange : art.leafGreen,
      })),
    [width, groundY],
  );
  return (
    <>
      {leaves.map((leaf) => (
        <FallingLeaf key={leaf.phase} {...leaf} size={width * 0.045} />
      ))}
    </>
  );
}

function FallingLeaf({
  image,
  x,
  top,
  fall,
  phase,
  size,
}: {
  readonly image: ArtImage;
  readonly x: number;
  readonly top: number;
  readonly fall: number;
  readonly phase: number;
  readonly size: number;
}) {
  const { time, width } = useWorld();
  const style = useAnimatedStyle(() => {
    const t = time.value;
    const progress = (((t * 0.09 + phase * 0.21) % 1) + 1) % 1;
    return {
      opacity: Math.sin(Math.PI * progress) * 0.95,
      transform: [
        { translateX: x + Math.sin(t * 1.3 + phase) * width * 0.05 + progress * width * 0.08 },
        { translateY: top + progress * fall },
        { rotate: `${Math.sin(t * 1.7 + phase) * 50}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.absolute, style]}>
      <Sprite art={image} left={-size / 2} top={-size / 2} width={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  firefly: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF2C2',
    boxShadow: '0 0 10px 4px rgba(255,224,140,0.75)',
  },
});
