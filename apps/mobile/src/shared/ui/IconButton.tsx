import { Pressable, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Круглая кнопка-иконка: подсветка при наведении, вдавливание при нажатии. */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  testID,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}) {
  const hovered = useSharedValue(0);
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + hovered.value * 0.06 - pressed.value * 0.12 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: hovered.value * 0.55 + pressed.value * 0.45,
    transform: [{ scale: 0.7 + hovered.value * 0.3 + pressed.value * 0.05 }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, motion.pressSpring);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { ...motion.pressSpring, damping: 9 });
      }}
      onHoverIn={() => {
        hovered.value = withTiming(1, { duration: 160 });
      }}
      onHoverOut={() => {
        hovered.value = withTiming(0, { duration: 220 });
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.button, style]}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(169,199,163,0.35)',
  },
});
