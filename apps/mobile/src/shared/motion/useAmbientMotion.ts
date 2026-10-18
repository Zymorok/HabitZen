import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPolicy } from './useMotionPolicy';

export function useAmbientMotion(enabled = true) {
  const { reducedMotion, foreground, animate } = useMotionPolicy();
  const cycle = useSharedValue(0);
  useEffect(() => {
    if (enabled && animate) {
      cycle.value = withRepeat(
        withTiming(1, {
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          // NOTE: Системное ограничение проверяется выше и обновляется событием ОС.
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
    } else {
      cancelAnimation(cycle);
      cycle.value = 0;
    }
    return () => cancelAnimation(cycle);
  }, [enabled, animate, cycle]);
  return { cycle, reducedMotion, foreground };
}
