import { useRouter } from 'expo-router';
import { useCallback, useEffect, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { Icon } from './Icon';

export function Sheet({
  children,
  testID,
}: {
  readonly children: ReactNode;
  readonly testID: string;
}) {
  const router = useRouter();
  const { theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sheet = document.querySelector<HTMLElement>('[data-testid="' + testID + '"]');
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() =>
      sheet?.querySelector<HTMLElement>('[data-testid="sheet-close"]')?.focus(),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab' || !sheet) return;
      const targets = Array.from(
        sheet.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'),
      );
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [close, testID]);
  return (
    <View
      style={styles.overlay}
      testID={testID}
      {...(Platform.OS === 'web'
        ? { role: 'dialog' as const, 'aria-modal': true }
        : { accessibilityViewIsModal: true })}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,28,21,0.4)' }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('close')}
      />
      <Animated.View
        entering={FadeInDown.duration(250)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            paddingBottom: Math.max(insets.bottom, 20),
            borderColor: theme.border,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.primarySoft }]} />
        <Pressable
          testID="sheet-close"
          style={styles.close}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        >
          <Icon name="close" size={21} color={theme.textMuted} />
        </Pressable>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '91%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 10,
    borderWidth: 1,
  },
  handle: { width: 40, height: 4, borderRadius: 4, alignSelf: 'center', opacity: 0.55 },
  close: { position: 'absolute', top: 16, right: 16, padding: 12, zIndex: 2 },
  content: { paddingTop: 28, paddingHorizontal: 26, gap: 18 },
});
