import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';

export type TextVariant = 'body' | 'small' | 'title' | 'brand' | 'button';
export const typography = {
  body: { fontFamily: 'Manrope_400Regular', fontSize: 15, lineHeight: 24 },
  small: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: 26, lineHeight: 35 },
  brand: { fontFamily: 'Lora_700Bold', fontSize: 48, lineHeight: 64, letterSpacing: -1.7 },
  button: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, lineHeight: 22 },
} as const;
export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { readonly variant?: TextVariant }) {
  const { theme } = useAppPreferences();
  return <Text {...props} style={[typography[variant], { color: theme.text }, style]} />;
}
