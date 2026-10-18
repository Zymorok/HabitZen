import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import type { StyleProp, TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { typography } from './AppText';
import type { TextVariant } from './AppText';

type Tone = 'text' | 'textMuted' | 'primary';

/**
 * Текст, цвет которого плавно перетекает вместе со сменой темы, а не перескакивает.
 * NOTE: Обычный AppText меняет цвет мгновенно; этот используется там, где смена темы видна целиком.
 */
export function ThemedText({
  children,
  variant = 'body',
  tone = 'text',
  style,
  testID,
  numberOfLines,
}: {
  readonly children: ReactNode;
  readonly variant?: TextVariant;
  readonly tone?: Tone;
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
  readonly numberOfLines?: number;
}) {
  const { night } = useAppPreferences();
  const light = lightTheme[tone];
  const dark = darkTheme[tone];
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(night.value, [0, 1], [light, dark]),
  }));
  return (
    <Animated.Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[typography[variant], style, colorStyle]}
    >
      {children}
    </Animated.Text>
  );
}
