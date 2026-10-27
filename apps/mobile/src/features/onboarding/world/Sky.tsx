import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Mask, Path, RadialGradient, Stop } from 'react-native-svg';
import { useWorld } from './WorldContext';
import { depth, layerWidth, lerp, seededRandom, skyline, smoothstep } from './geometry';

/**
 * Небо: дневной и ночной градиенты плавно перетекают друг в друга,
 * а посередине перехода у горизонта вспыхивает закат.
 */
export function Sky() {
  const { night, groundY, height } = useWorld();
  const horizon = Math.min(1, groundY / height);
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value }));
  // NOTE: Закат сильнее всего в середине смены темы и пропадает к её концу.
  const sunsetStyle = useAnimatedStyle(() => ({
    opacity: Math.pow(Math.sin(Math.PI * night.value), 1.1),
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FBF8EF', '#F8F0DE', '#EDF0E0']}
        locations={[0, horizon * 0.55, horizon]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, nightStyle]}>
        <LinearGradient
          colors={['#14231E', '#132833', '#21404B']}
          locations={[0, horizon * 0.55, horizon]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sunsetStyle]}>
        <LinearGradient
          colors={['rgba(96,78,140,0.35)', 'rgba(226,132,128,0.8)', 'rgba(250,164,96,1)']}
          locations={[horizon * 0.1, horizon * 0.62, horizon]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Вечерний свет поверх всего пейзажа: в середине смены темы горы, холмы и трава
 * на мгновение становятся тёплыми, как на закате, а не просто темнеют.
 */
export function DuskLight() {
  const { night } = useWorld();
  const style = useAnimatedStyle(() => ({
    opacity: Math.pow(Math.sin(Math.PI * night.value), 2) * 0.22,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: '#F07C3E' }, style]}
    />
  );
}

/** Солнце: тёплый диск, мягкое сияние и медленно вращающиеся лучи. При смене темы садится по дуге. */
export function Sun() {
  const { night, time, width, groundY, height } = useWorld();
  const radius = width * 0.058;
  const box = radius * 7;
  const startX = width * 0.8;
  const startY = skyline(width, groundY, height).sunY;
  const style = useAnimatedStyle(() => {
    const t = smoothstep(0, 0.85, night.value);
    const x = lerp(startX, width * 0.97, t);
    // NOTE: Опускается с ускорением — как настоящий закат, а не по прямой.
    const y = lerp(startY, groundY - width * 0.02, t * t);
    return {
      opacity: 1 - smoothstep(0.55, 0.9, night.value),
      transform: [{ translateX: x - box / 2 }, { translateY: y - box / 2 }],
    };
  });
  const raysStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + Math.sin(time.value * 0.6) * 0.15,
    transform: [{ rotate: `${(time.value * 3) % 360}deg` }],
  }));
  // NOTE: На закате диск краснеет.
  const duskStyle = useAnimatedStyle(() => ({ opacity: smoothstep(0.1, 0.6, night.value) }));
  const c = box / 2;
  const rays = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spread = 0.07;
      const inner = radius * 1.35;
      const outer = radius * (i % 2 ? 2.5 : 3.2);
      const p = (r: number, angle: number) =>
        `${c + Math.cos(angle) * r},${c + Math.sin(angle) * r}`;
      result.push(`M${p(inner, a - spread)} L${p(outer, a)} L${p(inner, a + spread)} Z`);
    }
    return result;
  }, [c, radius]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="world-sun"
      style={[{ position: 'absolute', width: box, height: box }, style]}
    >
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE7AE" stopOpacity="0.85" />
            <Stop offset="0.3" stopColor="#FFE3A3" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#FFE3A3" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#sunGlow)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
        <Svg width={box} height={box}>
          {/* NOTE: Ключ — номер луча: пока окно не измерено, все пути одинаковые («M0,0…»). */}
          {rays.map((d, index) => (
            <Path key={index} d={d} fill="#FFE2A0" opacity={0.32} />
          ))}
        </Svg>
      </Animated.View>
      {/* WARNING: На Android градиент виден только внутри своего Svg — описание держим рядом. */}
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sunDisc" cx="42%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#FFF7DF" />
            <Stop offset="1" stopColor="#FFD48A" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={radius} fill="url(#sunDisc)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, duskStyle]}>
        <Svg width={box} height={box}>
          <Circle cx={c} cy={c} r={radius} fill="#F29A64" opacity={0.85} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Луна: узнаваемый серп с кратерами, слабо видимая тёмная часть и холодный ореол.
 * NOTE: Специально не похожа на солнце: другая форма, цвет, место (слева) и свет.
 */
export function Moon() {
  const { night, time, width, groundY, height, howl } = useWorld();
  const radius = width * 0.066;
  const box = radius * 8;
  const endX = width * 0.2;
  const endY = skyline(width, groundY, height).moonY;
  const style = useAnimatedStyle(() => {
    const t = smoothstep(0.3, 1, night.value);
    const x = lerp(width * 0.04, endX, t);
    const y = lerp(groundY + radius, endY, Math.sqrt(t));
    return {
      opacity: smoothstep(0.3, 0.75, night.value),
      transform: [{ translateX: x - box / 2 }, { translateY: y - box / 2 }],
    };
  });
  // NOTE: Ореол еле заметно «дышит», а когда волк воет — разгорается.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + Math.sin(time.value * 0.5) * 0.1 + howl.value * 0.25,
    transform: [{ scale: 1 + Math.sin(time.value * 0.5) * 0.03 + howl.value * 0.22 }],
  }));
  const c = box / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID="world-moon"
      style={[{ position: 'absolute', width: box, height: box }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#D4E6F2" stopOpacity="0.5" />
              <Stop offset="0.28" stopColor="#B9D3E6" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#9CBBD3" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill="url(#moonHalo)" />
        </Svg>
      </Animated.View>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="moonCrescent" x="0" y="0" width={box} height={box} maskUnits="userSpaceOnUse">
            <Circle cx={c} cy={c} r={radius} fill="#FFFFFF" />
            <Circle
              cx={c + radius * 0.48}
              cy={c - radius * 0.22}
              r={radius * 0.93}
              fill="#000000"
            />
          </Mask>
          <RadialGradient id="moonLight" cx="35%" cy="45%" r="70%">
            <Stop offset="0" stopColor="#FBF8EC" />
            <Stop offset="1" stopColor="#DCD8C6" />
          </RadialGradient>
        </Defs>
        {/* NOTE: «Пепельный свет» — тёмная часть диска чуть видна, луна выглядит шаром. */}
        <Circle cx={c} cy={c} r={radius} fill="#A9BDCB" opacity={0.16} />
        <G mask="url(#moonCrescent)">
          <Circle cx={c} cy={c} r={radius} fill="url(#moonLight)" />
          <Circle cx={c - radius * 0.45} cy={c - radius * 0.1} r={radius * 0.17} fill="#CFC9B4" />
          <Circle cx={c - radius * 0.2} cy={c + radius * 0.48} r={radius * 0.12} fill="#D3CDB9" />
          <Circle cx={c - radius * 0.62} cy={c + radius * 0.35} r={radius * 0.08} fill="#CFC9B4" />
          <Circle cx={c - radius * 0.05} cy={c - radius * 0.55} r={radius * 0.07} fill="#D6D0BD" />
        </G>
      </Svg>
    </Animated.View>
  );
}

interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}
const STAR_GROUPS = 6;

/** Звёзды мерцают группами в разном ритме; иногда пролетает падающая звезда. */
export function Stars() {
  const { width, groundY } = useWorld();
  const span = layerWidth(width, depth.stars);
  const groups = useMemo(() => {
    const random = seededRandom(7);
    const result: Star[][] = Array.from({ length: STAR_GROUPS }, () => []);
    for (let i = 0; i < 54; i++) {
      result[i % STAR_GROUPS]!.push({
        x: random() * span,
        y: 12 + Math.pow(random(), 1.3) * Math.max(40, groundY - width * 0.5),
        r: 0.6 + Math.pow(random(), 3) * 1.4,
      });
    }
    return result;
  }, [span, groundY, width]);
  const sparkles = useMemo(() => {
    const random = seededRandom(19);
    return Array.from({ length: 5 }, (_, i) => ({
      x: (0.12 + i * 0.19 + random() * 0.06) * span,
      y: 30 + random() * Math.max(30, groundY - width * 0.85),
      size: 7 + random() * 5,
      phase: random() * 6,
    }));
  }, [span, groundY, width]);
  return (
    <>
      {groups.map((stars, index) => (
        <StarGroup key={index} stars={stars} index={index} span={span} height={groundY} />
      ))}
      {sparkles.map((sparkle) => (
        <Sparkle key={sparkle.phase} {...sparkle} />
      ))}
      <ShootingStar />
    </>
  );
}

function StarGroup({
  stars,
  index,
  span,
  height,
}: {
  readonly stars: readonly Star[];
  readonly index: number;
  readonly span: number;
  readonly height: number;
}) {
  const { night, time } = useWorld();
  const speed = 0.7 + index * 0.37;
  const phase = index * 1.9;
  const style = useAnimatedStyle(() => ({
    opacity:
      Math.pow(smoothstep(0.45, 1, night.value), 1.5) *
      (0.5 + 0.5 * Math.sin(time.value * speed + phase) * Math.sin(time.value * 0.31 + phase)),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { width: span, height: Math.max(1, height) }, style]}
    >
      <Svg width={span} height={Math.max(1, height)}>
        {stars.map((star) => (
          <Circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={star.r} fill="#F6F1DC" />
        ))}
      </Svg>
    </Animated.View>
  );
}

function Sparkle({
  x,
  y,
  size,
  phase,
}: {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly phase: number;
}) {
  const { night, time } = useWorld();
  const style = useAnimatedStyle(() => {
    const pulse = 0.5 + 0.5 * Math.sin(time.value * 1.3 + phase);
    return {
      opacity: smoothstep(0.55, 1, night.value) * (0.45 + pulse * 0.55),
      transform: [{ scale: 0.75 + pulse * 0.35 }, { rotate: `${pulse * 20}deg` }],
    };
  });
  const h = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { left: x - h, top: y - h, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Path
          d={`M${h} 0 Q${h} ${h} ${size} ${h} Q${h} ${h} ${h} ${size} Q${h} ${h} 0 ${h} Q${h} ${h} ${h} 0 Z`}
          fill="#FFF8E1"
        />
      </Svg>
    </Animated.View>
  );
}

const SHOOTING_PERIOD = 13;
const SHOOTING_DURATION = 0.9;

/** Падающая звезда раз в ~13 секунд, каждый раз в новом месте. */
function ShootingStar() {
  const { night, time, width, groundY } = useWorld();
  const length = width * 0.26;
  const style = useAnimatedStyle(() => {
    const cycle = Math.floor(time.value / SHOOTING_PERIOD);
    const local = time.value - cycle * SHOOTING_PERIOD;
    const progress = local / SHOOTING_DURATION;
    // NOTE: Простое детерминированное «случайное» место для каждого пролёта.
    const seed = Math.abs(Math.sin(cycle * 12.9898) * 43758.5453) % 1;
    const startX = width * (0.35 + seed * 0.6);
    const startY = 20 + seed * Math.max(30, groundY - width * 0.95);
    const visible = progress >= 0 && progress <= 1;
    return {
      opacity: visible ? smoothstep(0.6, 1, night.value) * Math.sin(Math.PI * progress) : 0,
      transform: [
        { translateX: startX - progress * width * 0.45 },
        { translateY: startY + progress * width * 0.2 },
        { rotate: '-24deg' },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { width: length, height: 2 }, style]}>
      <LinearGradient
        colors={['rgba(255,250,230,1)', 'rgba(255,250,230,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 2 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
});
