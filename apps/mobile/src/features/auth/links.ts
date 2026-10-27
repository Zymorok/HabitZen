import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Куда вернуть человека из письма: в браузере — на этот же сайт, на телефоне — в приложение.
 * NOTE: Один адрес для подтверждения почты и для нового пароля; экран auth/callback сам их различает.
 */
export function authCallbackUrl(): string {
  if (Platform.OS === 'web') return `${globalThis.location.origin}/auth/callback`;
  return Linking.createURL('/auth/callback');
}
