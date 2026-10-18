import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';

/** Перевод, закреплённый за показанным языком (см. смену языка в OnboardingScreen). */
export type Translate = (key: string, values?: Readonly<Record<string, string | number>>) => string;

/** Карточка живого примера. Цвета перетекают вместе со сменой темы. */
export function DemoCard({
  children,
  style,
  testID,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const { night } = useAppPreferences();
  const colors = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      ['rgba(255,252,244,0.94)', 'rgba(32,54,44,0.92)'],
    ),
    borderColor: interpolateColor(night.value, [0, 1], [lightTheme.border, darkTheme.border]),
  }));
  return (
    <Animated.View testID={testID} style={[styles.card, colors, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    boxShadow: '0 10px 28px rgba(18,47,32,0.12)',
  },
});
