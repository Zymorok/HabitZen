import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useNotificationPermission } from '../../../platform/permissions/useNotificationPermission';
import { habitColor, habitIcon } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useActiveHabits } from '../../habits/data/useHabits';
import { shiftTime } from '../../habits/time';
import { describeWeekdays } from '../../habits/weekdays';
import { useSaveSettings, useUserSettings } from '../../settings/data/useSettings';

/**
 * Напоминания (строка «Напоминания 21:00» кадра 12): общий выключатель, вечернее
 * напоминание и привычки со своим временем. Разрешение спрашивается при включении.
 */
export function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['settings', 'habits', 'common', 'permissions']);
  const { theme, night } = useAppPreferences();
  const settings = useUserSettings();
  const save = useSaveSettings();
  const habits = useActiveHabits();
  const permission = useNotificationPermission();
  const [timeOpen, setTimeOpen] = useState(false);
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));
  const enabled = settings.data?.remindersEnabled ?? false;
  const time = settings.data?.reminderTime ?? '21:00';
  const withReminders = (habits.data ?? []).filter((habit) => habit.reminderTimes.length > 0);
  const [asking, setAsking] = useState(false);
  // NOTE: Плашка о разрешении — только когда телефон его не дал, а не пока открыт системный вопрос.
  const blocked =
    enabled &&
    !asking &&
    permission.state !== null &&
    !permission.granted &&
    permission.state !== 'unavailable';
  // NOTE: Если телефон ещё может спросить сам — просим здесь; если отказ окончательный — в настройки.
  const canAsk = permission.state === 'undetermined' || permission.canAskAgain;

  const ask = async () => {
    setAsking(true);
    try {
      await permission.request();
    } finally {
      setAsking(false);
    }
  };
  const toggle = async (value: boolean) => {
    save.mutate({ remindersEnabled: value });
    // NOTE: Системный запрос — только в ответ на включение, а не при открытии экрана.
    if (value && !permission.granted) await ask();
  };

  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="reminders-screen"
    >
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="reminders-back"
        >
          <View style={styles.flip}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="title" style={styles.title}>
          {t('settings:reminders')}
        </ThemedText>
        <View style={styles.headerGap} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.row}>
            <Icon name="bell" size={22} color={theme.text} />
            <View style={styles.grow}>
              <AppText style={styles.rowLabel}>{t('settings:reminders')}</AppText>
              <AppText style={[styles.rowHint, { color: theme.textMuted }]}>
                {t('settings:reminders_hint')}
              </AppText>
            </View>
            <Switch
              value={enabled}
              disabled={!settings.data}
              onValueChange={(value) => void toggle(value)}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings:reminders')}
              testID="reminders-toggle"
            />
          </View>
        </Animated.View>

        {blocked ? (
          <Animated.View
            entering={FadeIn.duration(260)}
            style={[styles.banner, { backgroundColor: theme.surfaceMuted }]}
            testID="reminders-blocked"
          >
            <AppText style={styles.grow}>
              {canAsk ? t('settings:reminders_ask') : t('settings:reminders_permission')}
            </AppText>
            <Button
              label={canAsk ? t('permissions:allow') : t('permissions:settings')}
              variant="outline"
              onPress={() => void (canAsk ? ask() : permission.openSettings())}
              testID="reminders-permission"
            />
          </Animated.View>
        ) : null}
        {enabled && Platform.OS === 'web' ? (
          <AppText style={{ color: theme.textMuted }} testID="reminders-web-note">
            {t('settings:reminders_web')}
          </AppText>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(60).duration(300)}
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: enabled ? 1 : 0.55,
            },
          ]}
        >
          <Pressable
            onPress={() => setTimeOpen((open) => !open)}
            disabled={!enabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled, expanded: timeOpen }}
            testID="reminders-time"
            style={styles.row}
          >
            <Icon name="moon" size={22} color={theme.text} />
            <View style={styles.grow}>
              <AppText style={styles.rowLabel}>{t('settings:evening_reminder')}</AppText>
              <AppText style={[styles.rowHint, { color: theme.textMuted }]}>
                {t('settings:evening_hint')}
              </AppText>
            </View>
            <AppText style={styles.time} testID="reminders-time-value">
              {time}
            </AppText>
          </Pressable>
          {timeOpen && enabled ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.stepper}>
              {[-60, -15, 15, 60].map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => save.mutate({ reminderTime: shiftTime(time, minutes) })}
                  accessibilityRole="button"
                  testID={`reminders-shift-${minutes}`}
                  style={[styles.step, { borderColor: theme.border }]}
                >
                  <AppText style={styles.stepText}>
                    {minutes > 0 ? '+' : '−'}
                    {Math.abs(minutes) >= 60 ? '1:00' : '0:15'}
                  </AppText>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>

        <AppText style={styles.sectionTitle}>{t('settings:habit_reminders')}</AppText>
        {withReminders.length === 0 ? (
          <AppText style={{ color: theme.textMuted }} testID="reminders-habits-empty">
            {t('settings:habit_reminders_empty')}
          </AppText>
        ) : (
          <View
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            {withReminders.map((habit, index) => (
              <Pressable
                key={habit.id}
                onPress={() => router.push({ pathname: '/habit/new', params: { id: habit.id } })}
                accessibilityRole="button"
                testID="reminders-habit"
                style={[
                  styles.row,
                  index > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
                    : null,
                ]}
              >
                <View style={[styles.habitIcon, { backgroundColor: habitColor(habit.colorKey) }]}>
                  <Icon name={habitIcon(habit.iconKey)} size={18} color="#FFFDF3" strokeWidth={2} />
                </View>
                <View style={styles.grow}>
                  <AppText style={styles.rowLabel} numberOfLines={1}>
                    {habit.title}
                  </AppText>
                  <AppText style={[styles.rowHint, { color: theme.textMuted }]}>
                    {describeWeekdays(
                      habit.weekdayMask,
                      t('habits:weekdays_short').split(','),
                      t('habits:every_day'),
                    )}
                  </AppText>
                </View>
                <AppText style={styles.time}>{habit.reminderTimes.join(', ')}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  flip: { transform: [{ scaleX: -1 }] },
  title: { flex: 1, textAlign: 'center', fontSize: 22, lineHeight: 30 },
  headerGap: { width: 48 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  card: { borderRadius: 22, borderWidth: 1, boxShadow: '0 8px 22px rgba(18,47,32,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, padding: 14 },
  grow: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: 'Manrope_500Medium', fontSize: 16 },
  rowHint: { fontSize: 13, lineHeight: 18 },
  time: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, minWidth: 52, textAlign: 'right' },
  stepper: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  step: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  banner: { borderRadius: 18, padding: 14, gap: 10 },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, marginTop: 6 },
  habitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
