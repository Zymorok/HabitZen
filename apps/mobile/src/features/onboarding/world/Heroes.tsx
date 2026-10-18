import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { art } from './art';
import { useWorld } from './WorldContext';
import { ContactShadow, Sprite, Sway } from './primitives';
import type { ArtImage } from './primitives';
import { smoothstep } from './geometry';

// WARNING: Android не разбирает точку опоры вида «71.67999999999999%» — округляем до десятых.
const SPROUT_PIVOT = `${(art.sproutLeaves.pivotX * 100).toFixed(1)}% ${(art.sproutLeaves.pivotY * 100).toFixed(1)}%`;

/** Росток на холмике (страница 1). Листья качаются отдельно от земли. */
export function SproutHero() {
  const { width, groundY } = useWorld();
  const w = width * 0.46;
  const h = (w * art.sproutMound.height) / art.sproutMound.width;
  const left = width * 0.5 - w / 2;
  const top = groundY + width * 0.035 - h;
  return (
    <>
      <ContactShadow centerX={width * 0.5} y={groundY + width * 0.03} width={w * 1.05} />
      <View pointerEvents="none" style={{ position: 'absolute', left, top, width: w, height: h }}>
        <Sway
          testID="world-sprout-sway"
          amplitude={3.2}
          speed={1.05}
          phase={0.4}
          origin={SPROUT_PIVOT}
        >
          <Sprite art={art.sproutLeaves} left={0} top={0} width={w} testID="world-sprout" />
        </Sway>
        <Sprite art={art.sproutMound} left={0} top={0} width={w} />
      </View>
    </>
  );
}

/** Грядка (страница 2): три ростка — три привычки. Отмеченная привычка — росток подрастает. */
export function GardenHero() {
  const { width, groundY, gardenGrowth } = useWorld();
  const x0 = width;
  const w = width * 0.7;
  const h = (w * art.gardenBed.height) / art.gardenBed.width;
  const left = x0 + width * 0.5 - w / 2;
  const top = groundY + width * 0.06 - h;
  // NOTE: Ростки сажаются чуть выше середины грядки — там видна земля.
  const soilY = top + h * 0.45;
  return (
    <>
      <ContactShadow centerX={x0 + width * 0.5} y={groundY + width * 0.05} width={w * 1.02} />
      <Sprite art={art.gardenBed} left={left} top={top} width={w} />
      {[0.27, 0.5, 0.73].map((fraction, index) => (
        <GardenSprout
          key={fraction}
          centerX={left + w * fraction}
          soilY={soilY}
          size={width * 0.2}
          growth={gardenGrowth[index]!}
          phase={index * 1.7}
        />
      ))}
    </>
  );
}

function GardenSprout({
  centerX,
  soilY,
  size,
  growth,
  phase,
}: {
  readonly centerX: number;
  readonly soilY: number;
  readonly size: number;
  readonly growth: SharedValue<number>;
  readonly phase: number;
}) {
  const h = (size * art.sproutLeaves.height) / art.sproutLeaves.width;
  const pivotX = art.sproutLeaves.pivotX;
  const pivotY = art.sproutLeaves.pivotY;
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(growth.value, [0, 1], [0.62, 1.08]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: centerX - size * pivotX,
          top: soilY - h * pivotY,
          width: size,
          height: h,
          transformOrigin: SPROUT_PIVOT,
        },
        style,
      ]}
    >
      <Sway amplitude={4} speed={1.25} phase={phase} origin={SPROUT_PIVOT}>
        <Sprite art={art.sproutLeaves} left={0} top={0} width={size} />
      </Sway>
    </Animated.View>
  );
}

/** Озеро (страница 3): камыши качаются, по воде бегут блики, днём — солнечная дорожка, ночью — лунная. */
export function LakeHero() {
  const { width, groundY } = useWorld();
  const x0 = width * 2;
  const w = width * 0.94;
  const h = (w * art.lake.height) / art.lake.width;
  const left = x0 + width * 0.5 - w / 2;
  const top = groundY + width * 0.1 - h;
  const reedWidth = width * 0.2;
  const reedHeight = (reedWidth * art.reeds.height) / art.reeds.width;
  return (
    <>
      <Sprite art={art.lake} left={left} top={top} width={w} />
      <WaterGlints left={left + w * 0.2} top={top + h * 0.28} width={w * 0.6} height={h * 0.42} />
      {[
        { x: left + w * 0.02, flip: false, phase: 0 },
        { x: left + w * 0.8, flip: true, phase: 2.1 },
      ].map((reed) => (
        <View
          key={reed.phase}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: reed.x,
            top: top + h * 0.62 - reedHeight,
            width: reedWidth,
            height: reedHeight,
            transform: [{ scaleX: reed.flip ? -1 : 1 }],
          }}
        >
          <Sway amplitude={4.5} speed={0.9} phase={reed.phase}>
            <Sprite art={art.reeds} left={0} top={0} width={reedWidth} />
          </Sway>
        </View>
      ))}
    </>
  );
}

const GLINTS = [
  { x: 0.5, y: 0.25, w: 0.2, phase: 0 },
  { x: 0.46, y: 0.42, w: 0.3, phase: 1.3 },
  { x: 0.54, y: 0.58, w: 0.24, phase: 2.6 },
  { x: 0.5, y: 0.74, w: 0.34, phase: 3.9 },
  { x: 0.3, y: 0.5, w: 0.12, phase: 0.8 },
  { x: 0.72, y: 0.36, w: 0.1, phase: 2.2 },
] as const;

function WaterGlints({
  left,
  top,
  width,
  height,
}: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height }}>
      {GLINTS.map((glint) => (
        <Glint key={glint.phase} {...glint} areaWidth={width} areaHeight={height} />
      ))}
    </View>
  );
}

function Glint({
  x,
  y,
  w,
  phase,
  areaWidth,
  areaHeight,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly phase: number;
  readonly areaWidth: number;
  readonly areaHeight: number;
}) {
  const { time, night } = useWorld();
  const glintWidth = w * areaWidth;
  const style = useAnimatedStyle(() => {
    const pulse = 0.5 + 0.5 * Math.sin(time.value * 1.6 + phase);
    return {
      opacity: (0.25 + pulse * 0.6) * (0.75 + night.value * 0.25),
      backgroundColor: night.value > 0.5 ? '#DCEBF5' : '#FFF6DA',
      transform: [
        { translateX: Math.sin(time.value * 0.7 + phase) * areaWidth * 0.03 },
        { scaleX: 0.7 + pulse * 0.45 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glint,
        { left: x * areaWidth - glintWidth / 2, top: y * areaHeight, width: glintWidth },
        style,
      ]}
    />
  );
}

/** Холм с камнями и дерево (страница 4). Дерево растёт по уровням и чуть покачивает кроной. */
export function TreeHero() {
  const { width, groundY, treeGrowth, time } = useWorld();
  const x0 = width * 3;
  const hillW = width * 0.78;
  const hillH = (hillW * art.hillRocks.height) / art.hillRocks.width;
  const hillLeft = x0 + width * 0.5 - hillW / 2;
  const hillTop = groundY + width * 0.07 - hillH;
  // NOTE: Дерево сажается в плоскую середину холма.
  const baseY = hillTop + hillH * 0.34;
  const treeW = width * 0.58;
  const treeH = (treeW * art.tree.height) / art.tree.width;
  const saplingW = width * 0.32;
  const saplingH = (saplingW * art.sapling.height) / art.sapling.width;
  const treeStyle = useAnimatedStyle(() => ({
    opacity: smoothstep(0.35, 0.55, treeGrowth.value),
    transform: [
      { scale: interpolate(treeGrowth.value, [0.35, 1], [0.55, 1], 'clamp') },
      { rotate: `${Math.sin(time.value * 0.6) * 0.7}deg` },
    ],
  }));
  const saplingStyle = useAnimatedStyle(() => ({
    opacity: 1 - smoothstep(0.38, 0.55, treeGrowth.value),
    transform: [
      { scale: interpolate(treeGrowth.value, [0, 0.45], [0.75, 1.15], 'clamp') },
      { rotate: `${Math.sin(time.value * 0.9 + 1) * 1.6}deg` },
    ],
  }));
  return (
    <>
      <ContactShadow centerX={x0 + width * 0.5} y={groundY + width * 0.05} width={hillW} />
      <Animated.View
        pointerEvents="none"
        style={[growStyle(x0 + width * 0.5, baseY, saplingW, saplingH), saplingStyle]}
      >
        <Sprite art={art.sapling} left={0} top={0} width={saplingW} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        testID="world-tree"
        style={[growStyle(x0 + width * 0.5, baseY, treeW, treeH), treeStyle]}
      >
        <Sprite art={art.tree} left={0} top={0} width={treeW} />
      </Animated.View>
      <Sprite art={art.hillRocks} left={hillLeft} top={hillTop} width={hillW} />
    </>
  );
}

function growStyle(centerX: number, baseY: number, w: number, h: number) {
  return {
    position: 'absolute' as const,
    left: centerX - w / 2,
    top: baseY - h,
    width: w,
    height: h,
    transformOrigin: '50% 100%',
  };
}

/** Тропинка, скамейка и фонарь (страница 5). Ночью фонарь горит и чуть подрагивает. */
export function LanternHero() {
  const { width, groundY } = useWorld();
  const x0 = width * 4;
  const w = width * 0.92;
  const h = (w * art.pathBench.height) / art.pathBench.width;
  const left = x0 + width * 0.5 - w / 2;
  const top = groundY + width * 0.09 - h;
  const lanternH = width * 0.5;
  const lanternW = (lanternH * art.lantern.width) / art.lantern.height;
  const lanternX = x0 + width * 0.17;
  const lanternTop = groundY + width * 0.02 - lanternH;
  return (
    <>
      <Sprite art={art.pathBench} left={left} top={top} width={w} />
      <LanternLight
        centerX={lanternX}
        headY={lanternTop + lanternH * 0.13}
        groundY={groundY + width * 0.01}
        size={width}
      />
      <Sprite art={art.lantern} left={lanternX - lanternW / 2} top={lanternTop} width={lanternW} />
      <LanternFlame centerX={lanternX} headY={lanternTop + lanternH * 0.13} size={lanternW} />
    </>
  );
}

function LanternLight({
  centerX,
  headY,
  groundY,
  size,
}: {
  readonly centerX: number;
  readonly headY: number;
  readonly groundY: number;
  readonly size: number;
}) {
  const { night, time } = useWorld();
  const glow = size * 0.7;
  const pool = size * 0.8;
  // NOTE: Мерцание — сумма трёх синусоид разной частоты: живое пламя, а не мигалка.
  const style = useAnimatedStyle(() => {
    const t = time.value;
    const flicker =
      0.88 + Math.sin(t * 7.3) * 0.04 + Math.sin(t * 13.1 + 1) * 0.03 + Math.sin(t * 2.1) * 0.05;
    return { opacity: smoothstep(0.4, 0.9, night.value) * flicker };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg
        width={pool}
        height={pool * 0.3}
        style={{
          position: 'absolute',
          left: centerX - pool / 2 + size * 0.06,
          top: groundY - pool * 0.15,
        }}
      >
        <Defs>
          <RadialGradient id="lanternPool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFD58A" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={pool / 2}
          cy={pool * 0.15}
          rx={pool / 2}
          ry={pool * 0.15}
          fill="url(#lanternPool)"
        />
      </Svg>
      <Svg
        width={glow}
        height={glow}
        style={{ position: 'absolute', left: centerX - glow / 2, top: headY - glow / 2 }}
      >
        <Defs>
          <RadialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE3A1" stopOpacity="0.85" />
            <Stop offset="0.25" stopColor="#FFC873" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#FFC873" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={glow / 2} cy={glow / 2} rx={glow / 2} ry={glow / 2} fill="url(#lanternGlow)" />
      </Svg>
    </Animated.View>
  );
}

function LanternFlame({
  centerX,
  headY,
  size,
}: {
  readonly centerX: number;
  readonly headY: number;
  readonly size: number;
}) {
  const { night, time } = useWorld();
  const flame = size * 0.32;
  const style = useAnimatedStyle(() => ({
    opacity: smoothstep(0.4, 0.9, night.value) * (0.85 + Math.sin(time.value * 9) * 0.1),
    transform: [{ scale: 0.92 + Math.sin(time.value * 6.3) * 0.06 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flame,
        {
          left: centerX - flame / 2,
          top: headY - flame / 2,
          width: flame,
          height: flame,
          borderRadius: flame,
        },
        style,
      ]}
    />
  );
}

/** Трава, цветы и кусты вдоль земли. У каждого свой ритм покачивания. */
const PLANTS: readonly {
  readonly key: 'grass1' | 'grass2' | 'grass3' | 'flowers1' | 'flowers2' | 'bush';
  readonly x: number;
  readonly size: number;
  readonly lift?: number;
}[] = [
  { key: 'bush', x: 0.04, size: 0.3, lift: 0.02 },
  { key: 'grass2', x: 0.2, size: 0.14 },
  { key: 'flowers1', x: 0.78, size: 0.16 },
  { key: 'grass1', x: 0.93, size: 0.18 },
  { key: 'grass3', x: 1.06, size: 0.15 },
  { key: 'flowers2', x: 1.9, size: 0.15 },
  { key: 'grass2', x: 2.05, size: 0.13 },
  { key: 'bush', x: 2.96, size: 0.26, lift: 0.03 },
  { key: 'grass1', x: 3.1, size: 0.16 },
  { key: 'flowers1', x: 3.88, size: 0.15 },
  { key: 'grass3', x: 4.62, size: 0.16 },
  { key: 'flowers2', x: 4.86, size: 0.15 },
];

export function Plants() {
  const { width, groundY } = useWorld();
  return (
    <>
      {PLANTS.map((plant, index) => (
        <Plant
          key={`${plant.key}-${plant.x}`}
          image={art[plant.key]}
          centerX={plant.x * width}
          baseY={groundY + width * (0.035 + (plant.lift ?? 0))}
          size={plant.size * width}
          phase={index * 0.9}
          amplitude={plant.key === 'bush' ? 1.2 : 5}
        />
      ))}
    </>
  );
}

/** Крупная трава на переднем плане: едет быстрее страницы и создаёт глубину. */
const FOREGROUND: readonly {
  readonly x: number;
  readonly size: number;
  readonly key: 'grass1' | 'grass3' | 'bush';
}[] = [
  { x: -0.06, size: 0.3, key: 'grass1' },
  { x: 1.12, size: 0.34, key: 'bush' },
  { x: 2.38, size: 0.28, key: 'grass3' },
  { x: 3.62, size: 0.32, key: 'grass1' },
  { x: 4.98, size: 0.36, key: 'bush' },
  { x: 6.04, size: 0.3, key: 'grass3' },
];

export function ForegroundPlants() {
  const { width, groundY } = useWorld();
  return (
    <>
      {FOREGROUND.map((plant, index) => (
        <Plant
          key={plant.x}
          image={art[plant.key]}
          centerX={plant.x * width}
          baseY={groundY + width * 0.15}
          size={plant.size * width}
          phase={index * 1.3 + 0.5}
          amplitude={plant.key === 'bush' ? 1.5 : 6}
        />
      ))}
    </>
  );
}

function Plant({
  image,
  centerX,
  baseY,
  size,
  phase,
  amplitude,
}: {
  readonly image: ArtImage;
  readonly centerX: number;
  readonly baseY: number;
  readonly size: number;
  readonly phase: number;
  readonly amplitude: number;
}) {
  const h = (size * image.height) / image.width;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: centerX - size / 2,
        top: baseY - h,
        width: size,
        height: h,
      }}
    >
      <Sway amplitude={amplitude} speed={1.2 + (phase % 0.5)} phase={phase}>
        <Sprite art={image} left={0} top={0} width={size} />
      </Sway>
    </View>
  );
}

const styles = StyleSheet.create({
  glint: { position: 'absolute', height: 2.5, borderRadius: 2 },
  flame: {
    position: 'absolute',
    backgroundColor: '#FFE7A8',
    boxShadow: '0 0 12px 6px rgba(255,205,120,0.8)',
  },
});
