import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useState } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';
import { AppText } from './AppText';

/**
 * Поле ввода: подпись сверху, мягкая подсветка рамки при фокусе, ошибка под полем.
 * Для пароля — кнопка «показать/скрыть».
 */
export function TextField({
  label,
  error,
  hint,
  secure = false,
  showLabel,
  hideLabel,
  testID,
  ...input
}: Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  readonly label: string;
  readonly error?: string | null;
  readonly hint?: string;
  readonly secure?: boolean;
  readonly showLabel?: string;
  readonly hideLabel?: string;
  readonly testID?: string;
}) {
  const { theme, night } = useAppPreferences();
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);
  const frameStyle = useAnimatedStyle(() => {
    const idle = interpolateColor(night.value, [0, 1], [lightTheme.border, darkTheme.border]);
    const active = interpolateColor(night.value, [0, 1], [lightTheme.primary, darkTheme.primary]);
    return {
      borderColor: error ? theme.error : interpolateColor(focus.value, [0, 1], [idle, active]),
      backgroundColor: interpolateColor(
        night.value,
        [0, 1],
        [lightTheme.surface, darkTheme.surface],
      ),
      boxShadow: `0 0 0 ${focus.value * 3}px rgba(91,140,99,${focus.value * 0.18})`,
    };
  });
  return (
    <View style={styles.wrap}>
      <ThemedText variant="small" tone="textMuted" style={styles.label}>
        {label}
      </ThemedText>
      <Animated.View style={[styles.frame, frameStyle]}>
        <TextInput
          {...input}
          testID={testID}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          placeholderTextColor={theme.textMuted}
          onFocus={(event) => {
            focus.value = withTiming(1, { duration: 160 });
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            focus.value = withTiming(0, { duration: 200 });
            input.onBlur?.(event);
          }}
          style={[styles.input, { color: theme.text }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? showLabel : hideLabel}
            hitSlop={8}
            style={styles.eye}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <AppText
          variant="small"
          style={[styles.message, { color: theme.error }]}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </AppText>
      ) : hint ? (
        <ThemedText variant="small" tone="textMuted" style={styles.message}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: 'Manrope_500Medium', paddingHorizontal: 4 },
  frame: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: 'Manrope_400Regular', fontSize: 15, paddingVertical: 12 },
  eye: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  message: { paddingHorizontal: 4 },
});
