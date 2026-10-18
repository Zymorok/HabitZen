import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { art } from './art';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useWorld } from './WorldContext';
import { Sprite } from './primitives';
import type { ArtImage } from './primitives';
import { smoothstep } from './geometry';

/** Где стоит скала волка и где он ходит. Координаты — в слое холмов. */
export function wolfStage(width: number, groundY: number) {
  const rockWidth = width * 0.36;
  const rockHeight = (rockWidth * art.rock.height) / art.rock.width;
  const rockLeft = width * 0.56;
  const rockBottom = groundY - width * 0.11;
  const rockTop = rockBottom - rockHeight;
  return {
    rockWidth,
    rockLeft,
    rockTop,
    // NOTE: Верх скалы — плоская площадка примерно на пятой части высоты рисунка.
    plateauY: rockTop + rockHeight * 0.22,
    topX: rockLeft + rockWidth * 0.48,
    baseX: rockLeft + rockWidth * 1.02,
    groundFeetY: rockBottom - rockHeight * 0.06,
    enterX: rockLeft + rockWidth + width * 0.32,
    exitX: rockLeft + rockWidth + width * 0.55,
    wolfHeight: width * 0.12,
  };
}

// NOTE: Коды поз для расчётов на UI-потоке: 0 идёт, 1 сидит, 2 воет, 3 спит.
const WALK = 0;
const SIT = 1;
const HOWL = 2;
const SLEEP = 3;

interface Step {
  readonly pose: number;
  readonly ms: number;
  /** Смотрит вправо (спрайты нарисованы мордой влево). */
  readonly facingRight?: boolean;
  readonly to?: 'base' | 'top' | 'exit';
  readonly jump?: boolean;
  readonly fade?: 'in' | 'out';
  readonly howl?: boolean;
}

/**
 * Ночная история волка с паузами, чтобы не выглядело как бесконечный повтор:
 * приходит по холму, запрыгивает на скалу, садится, воет на луну, засыпает,
 * просыпается и уходит. Потом долго никого нет.
 */
const STORY: readonly Step[] = [
  { pose: WALK, ms: 3800, to: 'base', fade: 'in' },
  { pose: WALK, ms: 650, to: 'top', jump: true },
  { pose: SIT, ms: 2600 },
  { pose: HOWL, ms: 3400, howl: true },
  { pose: SIT, ms: 1700 },
  { pose: SLEEP, ms: 9500 },
  { pose: SIT, ms: 1900 },
  { pose: WALK, ms: 650, to: 'base', jump: true, facingRight: true },
  { pose: WALK, ms: 4200, to: 'exit', fade: 'out', facingRight: true },
  { pose: SIT, ms: 7000, fade: 'out' },
];

export function Wolf() {
  const { width, groundY, animate, time, night, howl } = useWorld();
  // NOTE: Тема читается отдельно: перерисовывается только волк, а не весь мир.
  const { isDark } = useAppPreferences();
  const stage = wolfStage(width, groundY);
  const x = useSharedValue(stage.topX);
  const y = useSharedValue(stage.plateauY);
  const facing = useSharedValue(1);
  const visible = useSharedValue(0);
  const pose = useSharedValue(SIT);

  useEffect(() => {
    // NOTE: Без движения волк просто сидит на скале — ночь всё равно «обитаема».
    if (!isDark || !animate) {
      x.value = stage.topX;
      y.value = stage.plateauY;
      facing.value = 1;
      pose.value = SIT;
      visible.value = withTiming(isDark ? 1 : 0, { duration: 400 });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const target = { base: stage.baseX, top: stage.topX, exit: stage.exitX } as const;
    const targetY = { base: stage.groundFeetY, top: stage.plateauY, exit: stage.groundFeetY };
    const run = (index: number) => {
      const step = STORY[index % STORY.length]!;
      if (index % STORY.length === 0) {
        x.value = stage.enterX;
        y.value = stage.groundFeetY;
        visible.value = 0;
      }
      pose.value = step.pose;
      facing.value = step.facingRight ? -1 : 1;
      if (step.fade === 'in') visible.value = withTiming(1, { duration: 900 });
      if (step.fade === 'out')
        visible.value = withDelay(step.ms * 0.55, withTiming(0, { duration: step.ms * 0.4 }));
      if (step.to) {
        x.value = withTiming(target[step.to], { duration: step.ms, easing: Easing.linear });
        const endY = targetY[step.to];
        if (step.jump) {
          // NOTE: Прыжок — дуга: вверх с замедлением и вниз с ускорением.
          const peak = Math.min(y.value, endY) - stage.wolfHeight * 0.55;
          y.value = withSequence(
            withTiming(peak, { duration: step.ms * 0.5, easing: Easing.out(Easing.quad) }),
            withTiming(endY, { duration: step.ms * 0.5, easing: Easing.in(Easing.quad) }),
          );
        } else {
          y.value = withTiming(endY, { duration: step.ms });
        }
      }
      if (step.howl) {
        howl.value = withSequence(
          withDelay(400, withTiming(1, { duration: 700 })),
          withDelay(step.ms - 1900, withTiming(0, { duration: 800 })),
        );
      }
      timer = setTimeout(() => run(index + 1), step.ms);
    };
    // NOTE: Первое появление — после паузы, когда глаз уже привык к ночной сцене.
    visible.value = 0;
    timer = setTimeout(() => run(0), 2200);
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(visible);
      howl.value = withTiming(0, { duration: 300 });
    };
  }, [
    isDark,
    animate,
    stage.topX,
    stage.plateauY,
    stage.baseX,
    stage.exitX,
    stage.enterX,
    stage.groundFeetY,
    stage.wolfHeight,
    x,
    y,
    facing,
    visible,
    pose,
    howl,
  ]);

  const scale = stage.wolfHeight / art.wolfWalk1.height;
  const containerStyle = useAnimatedStyle(() => {
    const walking = pose.value === WALK;
    const bob = walking ? -Math.abs(Math.sin(time.value * 9)) * stage.wolfHeight * 0.03 : 0;
    return {
      opacity: visible.value * smoothstep(0.5, 0.9, night.value),
      transform: [{ translateX: x.value }, { translateY: y.value + bob }, { scaleX: facing.value }],
    };
  });
  return (
    <Animated.View pointerEvents="none" testID="world-wolf" style={[styles.anchor, containerStyle]}>
      <PoseSprite image={art.wolfWalk1} scale={scale} pose={pose} code={WALK} frame={0} />
      <PoseSprite image={art.wolfWalk2} scale={scale} pose={pose} code={WALK} frame={1} />
      <PoseSprite image={art.wolfSit} scale={scale} pose={pose} code={SIT} />
      <PoseSprite image={art.wolfHowl} scale={scale} pose={pose} code={HOWL} />
      <PoseSprite image={art.wolfSleep} scale={scale} pose={pose} code={SLEEP} />
    </Animated.View>
  );
}

/** Одна поза волка, привязанная к точке между лапами. */
function PoseSprite({
  image,
  scale,
  pose,
  code,
  frame,
}: {
  readonly image: ArtImage;
  readonly scale: number;
  readonly pose: SharedValue<number>;
  readonly code: number;
  readonly frame?: number;
}) {
  const { time } = useWorld();
  const w = image.width * scale;
  const h = image.height * scale;
  const style = useAnimatedStyle(() => {
    let shown = pose.value === code;
    // NOTE: Два кадра шага сменяют друг друга — получается походка.
    if (shown && frame !== undefined) shown = Math.floor(time.value * 4.2) % 2 === frame;
    // NOTE: Спящий волк медленно дышит.
    const breath = code === SLEEP ? 1 + Math.sin(time.value * 1.5) * 0.025 : 1;
    return { opacity: shown ? 1 : 0, transform: [{ scaleY: breath }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -w / 2,
          top: -h,
          width: w,
          height: h,
          transformOrigin: '50% 100%',
        },
        style,
      ]}
    >
      <Sprite art={image} left={0} top={0} width={w} shade={0.5} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
});
