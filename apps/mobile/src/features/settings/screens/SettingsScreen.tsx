import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  SlideInDown,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useAuth } from '../../../core/auth/AuthProvider';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { resetTo } from '../../../navigation/reset-to';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { TextField } from '../../../shared/ui/TextField';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useDisplayName } from '../../habits/data/useHabits';
import { useSaveDisplayName, useSaveSettings, useUserSettings } from '../data/useSettings';
import { ThemePreview } from '../components/ThemePreview';
import { AccentPicker } from '../components/AccentPicker';

/**
 * Кадр 12 «Настройки»: профиль, напоминания, тёмная тема, звуки и предпросмотр темы.
 * Ниже макета — язык и выход из аккаунта.
 * NOTE: Тема и язык действуют сразу и хранятся на устройстве; звуки и напоминания —
 * в аккаунте, одинаково на всех устройствах.
 */
export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, i18n } = useTranslation(['settings', 'auth', 'common']);
  const { theme, isDark, night, palette, preferences, setTheme, setReducedMotion, setHaptics } =
    useAppPreferences();
  const { signOut, session } = useAuth();
  const name = useDisplayName();
  const settings = useUserSettings();
  const saveSettings = useSaveSettings();
  const [editing, setEditing] = useState(false);
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const displayName = name.data ?? session?.user.email ?? '';
  const previewWidth = Math.min(160, (Math.min(width, 520) - 40 - 24) / 2);
  const reminders = settings.data?.remindersEnabled
    ? settings.data.reminderTime
    : t('settings:off');

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="profile-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 14) + 8, maxWidth: 520 },
        ]}
      >
        <ThemedText variant="title" style={styles.title} testID="settings-title">
          {t('settings:title')}
        </ThemedText>

        <Animated.View entering={FadeInDown.duration(320)}>
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings:edit_name')}
            testID="profile-card"
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
            <View style={styles.grow}>
              <AppText style={styles.name} numberOfLines={1} testID="profile-name">
                {displayName}
              </AppText>
              <AppText style={[styles.subtitle, { color: theme.textMuted }]}>
                {t('settings:profile_subtitle')}
              </AppText>
            </View>
            <Icon name="pencil" size={18} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(70).duration(320)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Pressable
            onPress={() => router.push('/reminders')}
            accessibilityRole="button"
            testID="settings-reminders"
          >
            <Row icon="bell" label={t('settings:reminders')}>
              <AppText style={{ color: theme.textMuted }} testID="settings-reminders-value">
                {reminders}
              </AppText>
              <Icon name="arrow" size={16} color={theme.textMuted} />
            </Row>
          </Pressable>
          <Row icon="moon" label={t('settings:dark')}>
            <Switch
              value={isDark}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings:dark')}
              testID="profile-dark"
            />
          </Row>
          <Row icon="sound" label={t('settings:sounds')} last>
            <Switch
              value={settings.data?.soundsEnabled ?? true}
              disabled={!settings.data}
              onValueChange={(value) => saveSettings.mutate({ soundsEnabled: value })}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings:sounds')}
              testID="settings-sounds"
            />
          </Row>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(320)} style={styles.section}>
          <AppText style={styles.sectionTitle}>{t('settings:theme_preview')}</AppText>
          <View style={styles.previews} accessibilityRole="radiogroup">
            <ThemePreview
              dark={false}
              label={t('settings:light')}
              selected={preferences.theme === 'light'}
              width={previewWidth}
              onPress={() => setTheme('light')}
              testID="theme-light"
            />
            <ThemePreview
              dark
              label={t('settings:dark')}
              selected={preferences.theme === 'dark'}
              width={previewWidth}
              onPress={() => setTheme('dark')}
              testID="theme-dark"
            />
          </View>
          <Pressable
            onPress={() => setTheme('system')}
            accessibilityRole="radio"
            aria-checked={preferences.theme === 'system'}
            testID="theme-system"
            style={[
              styles.systemChip,
              {
                borderColor: preferences.theme === 'system' ? theme.primary : theme.border,
                backgroundColor:
                  preferences.theme === 'system' ? theme.surfaceMuted : 'transparent',
              },
            ]}
          >
            <Icon name="system" size={18} color={theme.primary} />
            <AppText style={styles.systemText}>{t('settings:system')}</AppText>
          </Pressable>
        </Animated.View>

        {/* NOTE: Цветовая тема (HZ-08) — ниже светлой и тёмной, тоже хранится на устройстве. */}
        <Animated.View entering={FadeInDown.delay(165).duration(320)} style={styles.section}>
          <AppText style={styles.sectionTitle}>{t('settings:accent_title')}</AppText>
          <AccentPicker />
        </Animated.View>

        {/* NOTE: «Удобство» — ниже макета: вибрацию и движение можно выключить (HZ-R27). */}
        <Animated.View
          entering={FadeInDown.delay(190).duration(320)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Row icon="hand" label={t('settings:haptics')}>
            <Switch
              value={preferences.haptics}
              onValueChange={setHaptics}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings:haptics')}
              testID="settings-haptics"
            />
          </Row>
          <Row icon="leaf" label={t('settings:reduced_motion')} last>
            <Switch
              value={preferences.reducedMotion}
              onValueChange={setReducedMotion}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings:reduced_motion')}
              testID="settings-reduced-motion"
            />
          </Row>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(230).duration(320)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Pressable
            onPress={() =>
              router.push({ pathname: '/preferences', params: { section: 'language' } })
            }
            accessibilityRole="button"
            testID="profile-language"
          >
            <Row icon="globe" label={t('settings:language')} last>
              <AppText style={{ color: theme.textMuted }}>{t(`common:${i18n.language}`)}</AppText>
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
      <NameEditor visible={editing} initial={name.data ?? ''} onClose={() => setEditing(false)} />
    </Animated.View>
  );
}

function Row({
  icon,
  label,
  last = false,
  children,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly last?: boolean;
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
      <Icon name={icon} size={22} color={theme.text} />
      <AppText style={styles.rowLabel}>{label}</AppText>
      {children}
    </View>
  );
}

/** Изменение имени: одно поле, проверка длины, сохранение в профиле аккаунта. */
function NameEditor({
  visible,
  initial,
  onClose,
}: {
  readonly visible: boolean;
  readonly initial: string;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const { theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const save = useSaveDisplayName();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (clean.length < 1 || clean.length > 80) {
      setError(t('settings:name_invalid'));
      return;
    }
    save.mutate(clean, {
      onSuccess: onClose,
      onError: () => setError(t('errors:unknown')),
    });
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={() => {
        setValue(initial);
        setError(null);
      }}
    >
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common:close')}
        />
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          testID="name-editor"
        >
          <AppText variant="button" style={styles.sheetTitle}>
            {t('settings:edit_name')}
          </AppText>
          <TextField
            label={t('settings:name_label')}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setError(null);
            }}
            maxLength={80}
            autoFocus
            error={error}
            testID="name-input"
          />
          <Button
            label={save.isPending ? t('common:loading') : t('common:save')}
            onPress={submit}
            disabled={save.isPending}
            testID="name-save"
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 40,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 24, lineHeight: 32, textAlign: 'center', alignSelf: 'stretch' },
  card: { borderRadius: 22, borderWidth: 1, boxShadow: '0 8px 22px rgba(18,47,32,0.06)' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Manrope_600SemiBold', fontSize: 24 },
  grow: { flex: 1, gap: 2 },
  name: { fontFamily: 'Manrope_600SemiBold', fontSize: 18, lineHeight: 24 },
  subtitle: { fontSize: 14, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  // WARNING: Подпись строки растягивается (flex): на Android текст по размеру содержимого
  // с этим шрифтом измеряется чуть уже и последнее слово обрезается.
  rowLabel: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16 },
  section: { gap: 12 },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16 },
  previews: { flexDirection: 'row', justifyContent: 'space-evenly' },
  // NOTE: Ширина задана явно, подпись — во всю ширину: см. WARNING у rowLabel.
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: 250,
    gap: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  systemText: { flex: 1, textAlign: 'center', fontFamily: 'Manrope_500Medium', fontSize: 14 },
  version: { textAlign: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,22,16,0.35)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 14,
  },
  sheetTitle: { fontSize: 17 },
});
