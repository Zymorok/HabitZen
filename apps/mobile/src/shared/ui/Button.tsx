import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { useMotionPolicy } from '../motion/useMotionPolicy';
import { textBlend } from '../motion/themeBlend';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// NOTE: Зелёный — основной цвет приложения; персиковый — перерыв на кадре 07.
const TONES = {
  green: {
    day: ['#4A8259', '#2D6249'],
    night: ['#B2CFA3', '#87A67D'],
    shadow: '#2D6249',
    glow: '0 8px 18px rgba(29,70,48,0.34)',
    outline: [lightTheme.primarySoft, darkTheme.primarySoft],
    text: [lightTheme.primary, darkTheme.primary],
    ripple: '#7FA978',
    hover: 'rgba(169,199,163,0.12)',
  },
  peach: {
    day: ['#F2A06F', '#E2794A'],
    night: ['#F6C7A2', '#E9A57B'],
    shadow: 'rgba(229,127,76,0.35)',
    glow: '0 8px 18px rgba(196,98,48,0.28)',
    outline: ['#F0C4A2', '#8A5A3E'],
    text: ['#B5602F', '#F3B483'],
    ripple: '#F3A16A',
    hover: 'rgba(243,161,106,0.12)',
  },
} as const;

/**
 * Кнопка с откликом: при наведении подрастает и светлеет, при нажатии вдавливается,
 * от пальца расходится мягкая волна, при отпускании пружинит обратно.
 * NOTE: Отключённая кнопка тоже отвечает на касание (так попросил владелец), но действие
 * не выполняет и для озвучивания остаётся «недоступной».
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'green',
  disabled = false,
  testID,
}: {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: 'primary' | 'outline' | 'quiet';
  readonly tone?: keyof typeof TONES;
  readonly disabled?: boolean;
  readonly testID?: string;
}) {
  const palette = TONES[tone];
  const { night } = useAppPreferences();
  const { reducedMotion } = useMotionPolicy();
  const primary = variant === 'primary';
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);
  const ripple = useSharedValue(0);
  const rippleX = useSharedValue(0);
  const rippleY = useSharedValue(0);
  const width = useSharedValue(300);
  const height = useSharedValue(54);
  const [shownLabel, setShownLabel] = useState(label);
  const labelOpacity = useSharedValue(1);
  const pressable = useRef<View>(null);

  // HACK: react-native-web ставит aria-disabled только вместе с disabled, а disabled
  // выключает отклик на нажатие. Поэтому в браузере пометка «недоступна» ставится напрямую.
  useEffect(() => {
    if (Platform.OS !== 'web' || !pressable.current) return;
    const element = pressable.current as unknown as HTMLElement;
    if (disabled) element.setAttribute('aria-disabled', 'true');
    else element.removeAttribute('aria-disabled');
  }, [disabled]);

  // NOTE: Новая подпись (например, после смены языка) проявляется, а не подменяется рывком.
  useEffect(() => {
    if (label === shownLabel) return;
    if (reducedMotion) {
      setShownLabel(label);
      return;
    }
    labelOpacity.value = withTiming(0, { duration: motion.languageOutMs }, (finished) => {
      if (finished) runOnJS(setShownLabel)(label);
    });
  }, [label, shownLabel, reducedMotion, labelOpacity]);
  useEffect(() => {
    labelOpacity.value = withTiming(1, { duration: motion.languageInMs });
  }, [shownLabel, labelOpacity]);

  const pressIn = (event: GestureResponderEvent) => {
    pressed.value = withSpring(1, motion.pressSpring);
    rippleX.value = event.nativeEvent.locationX;
    rippleY.value = event.nativeEvent.locationY;
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    if (Platform.OS !== 'web' && !reducedMotion)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  const pressOut = () => {
    pressed.value = withSpring(0, { ...motion.pressSpring, damping: 9 });
  };

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1 + hovered.value * 0.018 - pressed.value * 0.035,
      },
      { translateY: pressed.value * 1.5 - hovered.value * 1 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0.55 + hovered.value * 0.45, 0.15]),
    transform: [
      { translateY: interpolate(pressed.value, [0, 1], [6 + hovered.value * 3, 2]) },
      { scaleX: interpolate(pressed.value, [0, 1], [0.92 + hovered.value * 0.04, 0.86]) },
    ],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: hovered.value * 0.16 + pressed.value * 0.04,
  }));
  const pressShadeStyle = useAnimatedStyle(() => ({ opacity: pressed.value * 0.1 }));
  const rippleStyle = useAnimatedStyle(() => {
    const radius = Math.max(width.value, height.value) * 1.1;
    return {
      opacity: interpolate(ripple.value, [0, 0.15, 1], [0, 0.28, 0]),
      width: radius * 2,
      height: radius * 2,
      borderRadius: radius,
      left: rippleX.value - radius,
      top: rippleY.value - radius,
      transform: [{ scale: interpolate(ripple.value, [0, 1], [0.05, 1]) }],
    };
  });
  // NOTE: Заливка кнопки меняется тем же быстрым переключением, что и подпись:
  // светлый текст никогда не оказывается на светлой заливке.
  const nightGradientStyle = useAnimatedStyle(() => ({ opacity: textBlend(night.value) }));
  const outlineStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(night.value, [0, 1], [...palette.outline]),
    backgroundColor: interpolateColor(
      hovered.value,
      [0, 1],
      ['rgba(255,255,255,0)', primary ? 'rgba(255,255,255,0)' : palette.hover],
    ),
  }));
  const labelStyle = useAnimatedStyle(() => {
    const blend = textBlend(night.value);
    return {
      opacity: labelOpacity.value,
      transform: [{ translateY: (1 - labelOpacity.value) * 4 }],
      color: primary
        ? interpolateColor(blend, [0, 1], ['#FFFDF3', '#172B22'])
        : interpolateColor(blend, [0, 1], [...palette.text]),
    };
  });

  return (
    <View style={styles.wrapper}>
      {primary ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shadow,
            { backgroundColor: palette.shadow, boxShadow: palette.glow },
            shadowStyle,
          ]}
        />
      ) : null}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        ref={pressable}
        testID={testID}
        onPress={disabled ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onHoverIn={() => {
          hovered.value = withTiming(1, { duration: 160 });
        }}
        onHoverOut={() => {
          hovered.value = withTiming(0, { duration: 220 });
        }}
        onLayout={(event: LayoutChangeEvent) => {
          width.value = event.nativeEvent.layout.width;
          height.value = event.nativeEvent.layout.height;
        }}
        style={[
          styles.button,
          variant === 'outline' ? styles.outline : null,
          variant === 'outline' ? outlineStyle : null,
          bodyStyle,
        ]}
      >
        {primary ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={palette.day}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, nightGradientStyle]}
            >
              <LinearGradient
                colors={palette.night}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            {/* NOTE: Верхний блик — свет падает сверху, кнопка выглядит выпуклой. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.55 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.shine, shineStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.pressShade, pressShadeStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ripple,
            { backgroundColor: primary ? '#FFFFFF' : palette.ripple },
            rippleStyle,
          ]}
        />
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {shownLabel}
        </Animated.Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  // NOTE: Тень — отдельный слой под кнопкой: при нажатии она «прижимается» и бледнеет.
  shadow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 4,
    bottom: 4,
    borderRadius: 28,
    backgroundColor: '#2D6249',
    boxShadow: '0 8px 18px rgba(29,70,48,0.34)',
  },
  button: {
    minHeight: 54,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    overflow: 'hidden',
  },
  outline: { borderWidth: 1.25 },
  shine: { backgroundColor: '#FFFFFF' },
  pressShade: { backgroundColor: '#0B1E14' },
  ripple: { position: 'absolute' },
  label: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
