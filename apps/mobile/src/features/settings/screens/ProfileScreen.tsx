import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAuth } from '../../../core/auth/AuthProvider';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { resetTo } from '../../../navigation/reset-to';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useDisplayName } from '../../habits/data/useHabits';

/**
 * Профиль (часть кадра 12): имя, тёмная тема, язык и выход.
 * TODO(HZ-06): Напоминания, звуки, вибрация и предпросмотр темы.
 */
export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['settings', 'auth', 'common']);
  const { theme, isDark, night, setTheme } = useAppPreferences();
  const { signOut, session } = useAuth();
  const name = useDisplayName();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));
  const displayName = name.data ?? session?.user.email ?? '';
  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="profile-screen">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 14) + 8 }]}
      >
        <ThemedText variant="title" style={styles.title}>
          {t('settings:title')}
        </ThemedText>
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={[
            styles.card,
            styles.person,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <AppText style={[styles.avatarText, { color: theme.background }]}>
              {displayName.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={styles.name} numberOfLines={1} testID="profile-name">
              {displayName}
            </AppText>
            <AppText variant="small" style={{ color: theme.textMuted }}>
              {t('settings:profile_subtitle')}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(70).duration(320)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Row icon="moon" label={t('settings:dark')} last={false}>
            <Switch
              value={isDark}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              testID="profile-dark"
            />
          </Row>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/preferences', params: { section: 'language' } })
            }
            accessibilityRole="button"
            testID="profile-language"
          >
            <Row icon="globe" label={t('settings:language')} last>
              <AppText variant="small" style={{ color: theme.textMuted }}>
                {t(`common:${i18n.language}`)}
              </AppText>
              <Icon name="arrow" size={16} color={theme.textMuted} />
            </Row>
          </Pressable>
        </Animated.View>

        <Button
          label={t('auth:sign_out')}
          variant="outline"
          onPress={() => void signOut().then(() => resetTo(router, '/'))}
          testID="sign-out"
        />
        <AppText variant="small" style={[styles.version, { color: theme.textMuted }]}>
          HabitZen {Constants.expoConfig?.version ?? ''}
        </AppText>
      </ScrollView>
    </Animated.View>
  );
}

function Row({
  icon,
  label,
  last,
  children,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly last: boolean;
  readonly children: ReactNode;
}) {
  const { theme } = useAppPreferences();
  return (
    <View
      style={[
        styles.row,
        !last
          ? { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }
          : null,
      ]}
    >
      <Icon name={icon} size={20} color={theme.primary} />
      <AppText style={styles.rowLabel}>{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, lineHeight: 34, marginBottom: 4 },
  card: { borderRadius: 22, borderWidth: 1, boxShadow: '0 8px 22px rgba(18,47,32,0.06)' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Lora_700Bold', fontSize: 22 },
  name: { fontFamily: 'Manrope_600SemiBold', fontSize: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  rowLabel: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15 },
  version: { textAlign: 'center' },
});
