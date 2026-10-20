import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { localDate } from '@habitzen/core/calendar';
import { formatCalendarDate } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { habitArt } from '../../../shared/habit-art';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../data/habits-api';
import type { ArchivedHabit, Habit } from '../data/habits-api';
import {
  useActiveHabits,
  useArchivedHabits,
  useReorderHabits,
  useRestoreHabit,
} from '../data/useHabits';
import { amountText, isCountGoal } from '../goal';
import { ALL_WEEKDAYS, hasWeekday } from '../weekdays';
import { SortableList } from '../components/SortableList';

const ROW = 68;

/**
 * «Мои привычки» (HZ-09): свой порядок перетаскиванием — в нём же идут план дня и итоги —
 * и архив, из которого привычку можно вернуть. Нажатие на строку открывает изменение.
 */
export function MyHabitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['habits', 'common', 'errors']);
  const { theme, night, palette } = useAppPreferences();
  const habits = useActiveHabits();
  const archived = useArchivedHabits();
  const reorder = useReorderHabits();
  const restore = useRestoreHabit();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const list = habits.data ?? [];
  const byId = new Map(list.map((habit) => [habit.id, habit]));

  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="my-habits-screen"
    >
      <View style={styles.topBar}>
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="my-habits-back"
        >
          <View style={styles.flip}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="button" style={styles.topTitle}>
          {t('habits:my_habits')}
        </ThemedText>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 12 },
        ]}
      >
        {habits.isPending ? (
          <ActivityIndicator color={theme.primary} />
        ) : list.length === 0 ? (
          <AppText style={{ color: theme.textMuted }} testID="my-habits-empty">
            {t('habits:my_habits_empty')}
          </AppText>
        ) : (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.section}>
            <AppText variant="small" style={[styles.hint, { color: theme.textMuted }]}>
              {t('habits:order_hint')}
            </AppText>
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <SortableList
                ids={list.map((habit) => habit.id)}
                rowHeight={ROW}
                onDragging={setDragging}
                onReorder={(ids) => {
                  setError(null);
                  reorder.mutate(
                    { ids, requestId: newRequestId() },
                    { onError: (failure) => setError(t(errorMessageKey(failure))) },
                  );
                }}
                moveUpLabel={t('habits:move_up')}
                moveDownLabel={t('habits:move_down')}
                handleLabel={(id) => t('habits:drag_habit', { title: byId.get(id)?.title ?? '' })}
                renderRow={(id) => {
                  const habit = byId.get(id);
                  return habit ? (
                    <HabitLine
                      habit={habit}
                      onPress={() =>
                        router.push({ pathname: '/habit/new', params: { id: habit.id } })
                      }
                    />
                  ) : null;
                }}
              />
            </View>
          </Animated.View>
        )}

        {error ? (
          <AppText variant="small" style={{ color: theme.error }} testID="my-habits-error">
            {error}
          </AppText>
        ) : null}

        {(archived.data ?? []).length > 0 ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.section}>
            <AppText style={styles.sectionTitle}>{t('habits:archive_title')}</AppText>
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              testID="archive-list"
            >
              {(archived.data ?? []).map((habit, index) => (
                <ArchivedLine
                  key={habit.id}
                  habit={habit}
                  first={index === 0}
                  busy={restore.isPending && restore.variables?.habit.id === habit.id}
                  onRestore={() => {
                    setError(null);
                    restore.mutate(
                      { habit, requestId: newRequestId() },
                      { onError: (failure) => setError(t(errorMessageKey(failure))) },
                    );
                  }}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

/** «Каждый день · 8 стаканов · Утро» — коротко, как часто и сколько. */
function useSummary(habit: Habit): string {
  const { t, i18n } = useTranslation('habits');
  const shortNames = t('weekdays_short').split(',');
  const often =
    habit.frequency === 'weekly'
      ? `${habit.perWeek ?? 1} ${t('per_week_unit', { count: habit.perWeek ?? 1 })}`
      : habit.frequency === 'interval'
        ? capitalize(t('interval_unit', { count: habit.intervalDays ?? 2 }))
        : habit.weekdayMask === ALL_WEEKDAYS
          ? t('every_day')
          : shortNames.filter((_, day) => hasWeekday(habit.weekdayMask, day)).join(', ');
  return [
    often,
    isCountGoal(habit.goalTarget, habit.goalUnit)
      ? amountText(t, i18n.language, habit.goalTarget, habit.goalUnit)
      : null,
    habit.timeOfDay === 'any' ? null : t(`tod_${habit.timeOfDay}`),
  ]
    .filter(Boolean)
    .join(' · ');
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function HabitLine({ habit, onPress }: { readonly habit: Habit; readonly onPress: () => void }) {
  const { t } = useTranslation('habits');
  const { theme } = useAppPreferences();
  const summary = useSummary(habit);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={habit.title}
      accessibilityHint={t('edit_habit')}
      style={styles.line}
      testID="my-habit"
    >
      <Image
        source={habitArt(habit.iconKey)}
        style={styles.art}
        resizeMode="contain"
        accessible={false}
      />
      <View style={styles.text}>
        <AppText style={styles.title} numberOfLines={1}>
          {habit.title}
        </AppText>
        <AppText
          variant="small"
          style={[styles.summary, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {summary}
        </AppText>
      </View>
      <Icon name="arrow" size={16} color={theme.textMuted} />
    </Pressable>
  );
}

function ArchivedLine({
  habit,
  first,
  busy,
  onRestore,
}: {
  readonly habit: ArchivedHabit;
  readonly first: boolean;
  readonly busy: boolean;
  readonly onRestore: () => void;
}) {
  const { t, i18n } = useTranslation('habits');
  const { theme } = useAppPreferences();
  const date = formatCalendarDate(
    localDate(habit.archivedAt.slice(0, 10)),
    i18n.language as SupportedLocale,
  );
  return (
    <View
      style={[
        styles.archived,
        !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : null,
      ]}
      testID="archived-habit"
    >
      <Image
        source={habitArt(habit.iconKey)}
        style={[styles.art, styles.dim]}
        resizeMode="contain"
        accessible={false}
      />
      <View style={styles.text}>
        <AppText style={styles.title} numberOfLines={1}>
          {habit.title}
        </AppText>
        <AppText variant="small" style={[styles.summary, { color: theme.textMuted }]}>
          {t('archived_on', { date })}
        </AppText>
      </View>
      <View style={styles.restore}>
        <Button
          label={busy ? t('saving') : t('restore')}
          variant="outline"
          onPress={onRestore}
          disabled={busy}
          testID="archive-restore"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  spacer: { width: 44 },
  flip: { transform: [{ scaleX: -1 }] },
  content: { paddingHorizontal: 18, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  section: { gap: 8 },
  hint: { paddingHorizontal: 4 },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, paddingHorizontal: 4 },
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 14 },
  art: { width: 32, height: 32 },
  dim: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, alignSelf: 'stretch' },
  summary: { alignSelf: 'stretch' },
  archived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
  },
  restore: { width: 130 },
});
