import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
import tree from '../../../../assets/onboarding/tree.webp';

/**
 * Маленький экран «План на день» в светлой или тёмной теме (кадр 12, «Предпросмотр темы»).
 * NOTE: Цвета взяты из токенов темы, а не нарисованы картинкой, — превью всегда совпадает
 * с настоящим приложением.
 */
export function ThemePreview({
  dark,
  label,
  selected,
  width,
  onPress,
  testID,
}: {
  readonly dark: boolean;
  readonly label: string;
  readonly selected: boolean;
  readonly width: number;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  const palette = dark ? darkTheme : lightTheme;
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, motion.pressSpring);
  }, [selected, lift]);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 3 }, { scale: 1 + lift.value * 0.02 }],
  }));
  const height = Math.round(width * 1.05);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      testID={testID}
      style={styles.wrap}
    >
      <Animated.View
        style={[
          styles.card,
          {
            width,
            height,
            backgroundColor: palette.background,
            borderColor: selected ? theme.primary : theme.border,
            borderWidth: selected ? 2 : 1,
          },
          cardStyle,
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: palette.primarySoft }]} />
          <View style={[styles.dot, { backgroundColor: palette.border }]} />
        </View>
        <View style={[styles.scene, { height: height * 0.42 }]}>
          <Image
            source={dark ? hillsNight : hillsDay}
            style={{
              position: 'absolute',
              width: width * 1.3,
              height: width * 0.87,
              bottom: -width * 0.2,
              left: -width * 0.15,
            }}
            resizeMode="cover"
          />
          <Image
            source={tree}
            style={{ width: height * 0.36, height: height * 0.36, marginLeft: width * 0.42 }}
            resizeMode="contain"
          />
        </View>
        <View
          style={[styles.line, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={[styles.check, { backgroundColor: palette.success }]} />
          <View style={[styles.bar, { backgroundColor: palette.surfaceMuted, width: '62%' }]} />
        </View>
        <View
          style={[styles.line, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={[styles.check, { borderColor: palette.primarySoft, borderWidth: 1 }]} />
          <View style={[styles.bar, { backgroundColor: palette.surfaceMuted, width: '48%' }]} />
        </View>
      </Animated.View>
      <AppText style={[styles.label, { color: theme.text }]}>{label}</AppText>
      <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: theme.primary }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 8,
    gap: 6,
    boxShadow: '0 8px 18px rgba(18,47,32,0.10)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 4 },
  scene: { borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  check: { width: 9, height: 9, borderRadius: 5 },
  bar: { height: 5, borderRadius: 3 },
  label: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
