import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';

import sproutLeaves from '../../../../assets/onboarding/sprout_leaves.webp';
import sproutMound from '../../../../assets/onboarding/sprout_mound.webp';

/**
 * Общая рамка экранов входа: росток из знакомства, заголовок, пояснение и форма.
 * NOTE: Росток тот же, что на первом экране, — человек чувствует, что остался в том же мире.
 */
export function AuthLayout({
  title,
  body,
  children,
  footer,
  testID,
}: {
  readonly title: string;
  readonly body: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly testID: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const { isDark, night } = useAppPreferences();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));
  return (
    <Animated.View style={[styles.shell, shellStyle]} testID={testID}>
      <LinearGradient
        pointerEvents="none"
        colors={isDark ? ['#132833', 'rgba(20,35,30,0)'] : ['#EEF1E0', 'rgba(251,248,239,0)']}
        style={styles.glow}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 20) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.toolbar}>
            <IconButton
              accessibilityLabel={t('back')}
              testID="auth-back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            >
              <View style={styles.backIcon}>
                <Icon name="arrow" color={isDark ? darkTheme.text : lightTheme.text} />
              </View>
            </IconButton>
          </View>
          <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
            <View style={styles.sprout}>
              <Image source={sproutLeaves} style={styles.sproutImage} resizeMode="contain" />
              <Image source={sproutMound} style={styles.sproutImage} resizeMode="contain" />
            </View>
            <ThemedText variant="title" style={styles.title}>
              {title}
            </ThemedText>
            <ThemedText tone="textMuted" style={styles.body}>
              {body}
            </ThemedText>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(90).duration(420)} style={styles.form}>
            {children}
          </Animated.View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  flex: { flex: 1 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 320 },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 18 },
  toolbar: { flexDirection: 'row', minHeight: 48, alignItems: 'center' },
  // NOTE: Стрелка в наборе иконок смотрит вправо; для «назад» разворачиваем её.
  backIcon: { transform: [{ scaleX: -1 }] },
  hero: { alignItems: 'center', gap: 8 },
  sprout: { width: 112, height: 112, marginBottom: 4 },
  // WARNING: Явные размеры обязательны: без них Android берёт исходный размер картинки (~1000 px).
  sproutImage: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320 },
  form: { gap: 14 },
  footer: { alignItems: 'center', gap: 4, marginTop: 'auto' },
});
