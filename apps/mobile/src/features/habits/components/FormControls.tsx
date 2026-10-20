import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useHaptics } from '../../../shared/haptics';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';

/** Выбор одного варианта из нескольких — «пилюля», как дни недели на кадре 03. */
export function Chip({
  label,
  selected,
  onPress,
  testID,
  style,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppPreferences();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      <AppText
        style={[styles.chipText, { color: selected ? theme.background : theme.text }]}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Счётчик «− значение +»: цель привычки, «N раз в неделю», «каждые N дней».
 * NOTE: Значение подпрыгивает при изменении — видно, что нажатие сработало.
 */
export function NumberStepper({
  value,
  label,
  min,
  max,
  step = 1,
  onChange,
  testID,
}: {
  readonly value: number;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  const haptics = useHaptics();
  const bump = useSharedValue(0);
  const valueStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + bump.value * 0.12 }] }));
  const change = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value) return;
    haptics.selection();
    bump.value = 1;
    bump.value = withSpring(0, motion.pressSpring);
    onChange(clamped);
  };
  return (
    <View
      style={[styles.stepper, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={testID}
    >
      <Pressable
        onPress={() => change(value - step)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`−${step}`}
        testID={`${testID}-minus`}
        style={[styles.round, { borderColor: theme.border, opacity: value <= min ? 0.4 : 1 }]}
      >
        <AppText style={styles.sign}>−</AppText>
      </Pressable>
      <Animated.View style={[styles.center, valueStyle]}>
        <AppText style={styles.value} testID={`${testID}-value`}>
          {value}
        </AppText>
        <AppText style={[styles.label, { color: theme.textMuted }]} numberOfLines={1}>
          {label}
        </AppText>
      </Animated.View>
      <Pressable
        onPress={() => change(value + step)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`+${step}`}
        testID={`${testID}-plus`}
        style={[
          styles.round,
          {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            opacity: value >= max ? 0.4 : 1,
          },
        ]}
      >
        <Icon name="plus" size={18} color={theme.background} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1.25,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: { fontFamily: 'Manrope_600SemiBold', fontSize: 20, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center' },
  value: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    lineHeight: 28,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  label: { fontSize: 13, alignSelf: 'stretch', textAlign: 'center' },
});
