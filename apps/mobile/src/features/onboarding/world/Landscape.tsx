import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { art } from './art';
import { useWorld } from './WorldContext';
import { ParallaxLayer, Sprite } from './primitives';
import { depth, layerWidth, skyline, smoothstep } from './geometry';
import { Wolf, wolfStage } from './Wolf';

/** Дальние горы: самый медленный слой. Ночной вариант нарисован отдельно, с лунной кромкой. */
export function Mountains() {
  const { width, height, groundY } = useWorld();
  const layer = layerWidth(width, depth.mountains) * 1.02;
  const imageHeight = (layer * art.mountainsDay.height) / art.mountainsDay.width;
  // NOTE: Хребет поднимается не выше трети экрана, чтобы не лезть под заголовок.
  const ridgeY = skyline(width, groundY, height).mountainRidge;
  return (
    <ParallaxLayer factor={depth.mountains}>
      <Sprite
        art={art.mountainsDay}
        nightArt={art.mountainsNight}
        left={0}
        top={ridgeY - art.mountainsDay.top * imageHeight}
        width={layer}
      />
    </ParallaxLayer>
  );
}

/** Холмы с домиком и скалой волка. Едут быстрее гор, но медленнее земли. */
export function Hills() {
  const { width, height, groundY } = useWorld();
  const layer = layerWidth(width, depth.hills) * 1.02;
  const imageHeight = (layer * art.hillsDay.height) / art.hillsDay.width;
  const ridgeY = skyline(width, groundY, height).hillRidge;
  const stage = wolfStage(width, groundY);
  return (
    <ParallaxLayer factor={depth.hills} testID="world-hills">
      <Sprite
        art={art.hillsDay}
        nightArt={art.hillsNight}
        left={0}
        top={ridgeY - art.hillsDay.top * imageHeight}
        width={layer}
      />
      <Sprite
        art={art.rock}
        left={stage.rockLeft}
        top={stage.rockTop}
        width={stage.rockWidth}
        shade={0.62}
      />
      <Wolf />
    </ParallaxLayer>
  );
}

const CLOUDS = [
  { key: 'cloud1', y: 0.55, size: 0.3, speed: 5.5, offset: 0.1 },
  { key: 'cloud2', y: 0.1, size: 0.2, speed: 3.6, offset: 0.62 },
  { key: 'cloud3', y: 0.8, size: 0.25, speed: 4.4, offset: 1.15 },
] as const;

/** Облака медленно плывут. Ночью тускнеют и подсвечиваются луной. */
export function Clouds() {
  const { width, groundY, height } = useWorld();
  const span = layerWidth(width, depth.clouds) + width * 0.8;
  const { cloudTop, cloudBottom } = skyline(width, groundY, height);
  return (
    <ParallaxLayer factor={depth.clouds}>
      {CLOUDS.map((cloud) => (
        <DriftingCloud
          key={cloud.key}
          artKey={cloud.key}
          top={cloudTop + cloud.y * (cloudBottom - cloudTop)}
          cloudWidth={cloud.size * width}
          speed={cloud.speed}
          offset={cloud.offset * width}
          span={span}
        />
      ))}
    </ParallaxLayer>
  );
}

function DriftingCloud({
  artKey,
  top,
  cloudWidth,
  speed,
  offset,
  span,
}: {
  readonly artKey: 'cloud1' | 'cloud2' | 'cloud3';
  readonly top: number;
  readonly cloudWidth: number;
  readonly speed: number;
  readonly offset: number;
  readonly span: number;
}) {
  const { time, night } = useWorld();
  const style = useAnimatedStyle(() => ({
    opacity: 1 - night.value * 0.45,
    transform: [{ translateX: ((offset + time.value * speed) % span) - cloudWidth }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.absolute, style]}>
      <Sprite art={art[artKey]} left={0} top={top} width={cloudWidth} shade={0.7} rim={false} />
    </Animated.View>
  );
}

const BIRD_PERIOD = 26;
const FLOCK = [
  { dx: 0, dy: 0, size: 1 },
  { dx: -0.06, dy: 0.025, size: 0.8 },
  { dx: -0.1, dy: -0.018, size: 0.75 },
  { dx: -0.15, dy: 0.04, size: 0.65 },
  { dx: -0.19, dy: 0.008, size: 0.6 },
] as const;

/** Днём через небо иногда пролетает небольшая стая птиц. */
export function Birds() {
  const { width, groundY, height } = useWorld();
  const y = skyline(width, groundY, height).birdY;
  return (
    <>
      {FLOCK.map((bird, index) => (
        <Bird key={index} index={index} baseY={y + bird.dy * width} dx={bird.dx} size={bird.size} />
      ))}
    </>
  );
}

function Bird({
  index,
  baseY,
  dx,
  size,
}: {
  readonly index: number;
  readonly baseY: number;
  readonly dx: number;
  readonly size: number;
}) {
  const { time, night, width } = useWorld();
  const w = 16 * size;
  const style = useAnimatedStyle(() => {
    const local = (time.value % BIRD_PERIOD) / 14;
    const visible = local <= 1;
    const x = (-0.2 + dx + local * 1.5) * width;
    return {
      opacity: visible ? (1 - smoothstep(0.2, 0.6, night.value)) * 0.75 : 0,
      transform: [
        { translateX: x },
        { translateY: baseY + Math.sin(local * 6 + index) * 4 },
        // NOTE: Взмах крыльев — сжатие по вертикали.
        { scaleY: 0.35 + 0.65 * Math.abs(Math.sin(time.value * 7 + index * 1.3)) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.absolute, { width: w, height: w / 2 }, style]}
    >
      <Svg width={w} height={w / 2} viewBox="0 0 16 8">
        <Path
          d="M0 6 Q4 0 8 5 Q12 0 16 6"
          stroke="#5E6B5A"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute', left: 0, top: 0 },
});
