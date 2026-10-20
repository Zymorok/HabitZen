import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { localDate } from '@habitzen/core/calendar';
import { formatCalendarDate } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { useGarden } from '../../garden/data/useGarden';
import { useActiveHabits, useArchiveHabit } from '../../habits/data/useHabits';
import {
  planProgress,
  usePlanCommand,
  usePlanProgress,
  useStreak,
  useTodayPlan,
} from '../data/usePlan';
import { goalStep, groupByTimeOfDay } from '../../habits/goal';
import type { PlanItem } from '../data/plan-api';
import { greetingKey, isDaytime } from '../greeting';
import { PlanRow } from '../components/PlanRow';
import { RowMenu } from '../../../shared/ui/RowMenu';
import type { MenuAction } from '../../../shared/ui/RowMenu';
import { TodayHero } from '../components/TodayHero';
import { openFocusFor } from '../../../navigation/reset-to';

/**
 * Кадр 02 «План на день»: приветствие, дерево и серия, прогресс дня, привычки на сегодня.
 * NOTE: С HZ-08 привычки делятся на «Утро / День / Вечер», если хоть у одной задано время дня.
 */
export function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation(['habits', 'errors', 'common', 'progress']);
  const { theme, night, palette } = useAppPreferences();
  const plan = useTodayPlan();
  const streak = useStreak();
  const garden = useGarden();
  const command = usePlanCommand();
  const amounts = usePlanProgress();
  const habits = useActiveHabits();
  const archive = useArchiveHabit();
  const [menuItem, setMenuItem] = useState<PlanItem | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hour = new Date().getHours();
  const items = useMemo(() => plan.data ?? [], [plan.data]);
  const progress = planProgress(items);
  const groups = useMemo(() => groupByTimeOfDay(items), [items]);
  const amountError = amounts.error ? t(errorMessageKey(amounts.error)) : null;
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const date = items[0]?.localDate ?? new Date().toISOString().slice(0, 10);

  const run = (kind: 'skip' | 'undo' | 'complete', item: PlanItem) => {
    setActionError(null);
    setBusyItem(item.itemId);
    command.mutate(
      // NOTE: Номер запроса привязан к версии отметки: повтор того же действия не удвоится.
      { command: kind, item, requestId: newRequestId() },
      {
        onError: (error) => setActionError(t(errorMessageKey(error))),
        onSettled: () => setBusyItem(null),
      },
    );
  };

  const menuActions = (item: PlanItem): MenuAction[] => {
    const habit = habits.data?.find((entry) => entry.id === item.habitId);
    const list: MenuAction[] = [];
    if (item.status === 'pending')
      list.push({
        key: 'skip',
        label: t('habits:skipped'),
        icon: 'moon',
        onPress: () => run('skip', item),
      });
    if (item.status !== 'pending')
      list.push({
        key: 'undo',
        label: t('habits:undo'),
        icon: 'arrow',
        onPress: () => run('undo', item),
      });
    if (item.status !== 'skipped')
      list.push({
        key: 'focus',
        label: t('habits:focus_for'),
        icon: 'clock',
        onPress: () => openFocusFor(router, item.habitId),
      });
    if (habit) {
      list.push({
        key: 'stats',
        label: t('progress:habit_stats'),
        icon: 'chart',
        onPress: () =>
          router.push({ pathname: '/habit/stats/[habitId]', params: { habitId: habit.id } }),
      });
      list.push({
        key: 'edit',
        label: t('habits:edit_habit'),
        icon: 'settings',
        onPress: () => router.push({ pathname: '/habit/new', params: { id: habit.id } }),
      });
      list.push({
        key: 'archive',
        label: t('habits:archive'),
        icon: 'archive',
        danger: true,
        onPress: () =>
          archive.mutate(
            { habit, requestId: newRequestId() },
            { onError: (error) => setActionError(t(errorMessageKey(error))) },
          ),
      });
    }
    return list;
  };

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="today-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={plan.isRefetching}
            onRefresh={() => {
              void plan.refetch();
              void streak.refetch();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
          <View style={styles.headerText}>
            <ThemedText variant="title" style={styles.greeting} testID="today-greeting">
              {t(`habits:${greetingKey(hour)}`)}
            </ThemedText>
            <ThemedText tone="textMuted" style={styles.date}>
              {formatCalendarDate(localDate(date), i18n.language as SupportedLocale)}
            </ThemedText>
          </View>
          <Icon
            name={isDaytime(hour) ? 'sun' : 'moon'}
            size={28}
            color={isDaytime(hour) ? '#E9A23B' : '#A9BDCB'}
          />
        </View>
        <TodayHero
          streak={streak.data?.current ?? 0}
          freezes={streak.data?.freezes ?? 0}
          level={garden.data?.level ?? 1}
          height={168}
          onTreePress={() => router.push('/garden')}
        />

        <View style={styles.body}>
          {plan.isPending ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : plan.isError ? (
            <View
              style={[
                styles.card,
                styles.center,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <AppText style={{ color: theme.error, textAlign: 'center' }} testID="today-error">
                {t(errorMessageKey(plan.error))}
              </AppText>
              <Button
                label={t('common:retry')}
                variant="outline"
                onPress={() => void plan.refetch()}
              />
            </View>
          ) : items.length === 0 ? (
            <EmptyPlan
              hasHabits={(habits.data?.length ?? 0) > 0}
              onCreate={() => router.push('/habit/new')}
            />
          ) : (
            <>
              <ProgressCard
                completed={progress.completed}
                total={progress.total}
                allDone={progress.allDone}
              />
              <View testID="plan-list" style={styles.groups}>
                {groups.map((group, groupIndex) => (
                  <Animated.View
                    key={group.key}
                    entering={FadeInDown.delay(80 + groupIndex * 60).duration(380)}
                    style={styles.group}
                    testID={`plan-section-${group.key}`}
                  >
                    {group.titled ? (
                      <ThemedText tone="textMuted" variant="small" style={styles.groupTitle}>
                        {t(`habits:section_${group.key}`)}
                      </ThemedText>
                    ) : null}
                    <View
                      style={[
                        styles.list,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      {group.items.map((item, index) => (
                        <PlanRow
                          key={item.itemId}
                          item={item}
                          busy={busyItem === item.itemId}
                          last={index === group.items.length - 1}
                          onOpen={() =>
                            router.push({
                              pathname: '/habit/[itemId]',
                              params: { itemId: item.itemId },
                            })
                          }
                          onSkip={() => run('skip', item)}
                          onMenu={() => setMenuItem(item)}
                          onAdd={() =>
                            // NOTE: Набранная цель ведёт на кадр 05, как и отметка удержанием.
                            amounts.add(item, goalStep(item.goalUnit), () =>
                              router.push({ pathname: '/done', params: { itemId: item.itemId } }),
                            )
                          }
                        />
                      ))}
                    </View>
                  </Animated.View>
                ))}
              </View>
            </>
          )}
          {actionError || amountError ? (
            <AppText
              variant="small"
              style={{ color: theme.error, textAlign: 'center' }}
              testID="today-action-error"
            >
              {actionError ?? amountError}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
      {items.length > 0 ? (
        <AddButton onPress={() => router.push('/habit/new')} label={t('habits:new_habit')} />
      ) : null}
      <RowMenu
        title={menuItem?.title ?? ''}
        visible={menuItem !== null}
        actions={menuItem ? menuActions(menuItem) : []}
        onClose={() => setMenuItem(null)}
      />
    </Animated.View>
  );
}

function ProgressCard({
  completed,
  total,
  allDone,
}: {
  readonly completed: number;
  readonly total: number;
  readonly allDone: boolean;
}) {
  const { t } = useTranslation('habits');
  const { theme } = useAppPreferences();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(total ? completed / total : 0, { duration: 650 });
  }, [completed, total, fill]);
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={[
        styles.card,
        styles.progressCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      testID="today-progress"
    >
      <AppText style={styles.progressText}>
        {total > 0 ? t('daily_progress', { completed, total }) : t('daily_optional')}
      </AppText>
      <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
        <Animated.View style={[styles.bar, { backgroundColor: theme.success }, barStyle]} />
      </View>
      {allDone ? (
        <View style={styles.doneRow}>
          <Icon name="leaf" size={15} color={theme.success} />
          <AppText variant="small" style={{ color: theme.success }} testID="today-all-done">
            {t('day_complete')}
          </AppText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function EmptyPlan({
  hasHabits,
  onCreate,
}: {
  readonly hasHabits: boolean;
  readonly onCreate: () => void;
}) {
  const { t } = useTranslation('habits');
  const { theme } = useAppPreferences();
  return (
    <Animated.View
      entering={FadeInDown.duration(380)}
      style={[
        styles.card,
        styles.empty,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      testID="today-empty"
    >
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceMuted }]}>
        <Icon name="leaf" size={26} color={theme.primary} />
      </View>
      <ThemedText variant="button" style={styles.emptyTitle}>
        {t(hasHabits ? 'free_day_title' : 'empty_title')}
      </ThemedText>
      <ThemedText tone="textMuted" style={styles.emptyBody}>
        {t(hasHabits ? 'free_day_body' : 'empty_body')}
      </ThemedText>
      <Button label={t('new_habit')} onPress={onCreate} testID="today-create" />
    </Animated.View>
  );
}

/** Круглая кнопка «+» как на макете: вдавливается и чуть поворачивается при нажатии. */
function AddButton({ onPress, label }: { readonly onPress: () => void; readonly label: string }) {
  const { theme } = useAppPreferences();
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }, { rotate: `${pressed.value * 45}deg` }],
  }));
  return (
    <Animated.View style={[styles.fab, { backgroundColor: theme.primary }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, motion.pressSpring);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, motion.pressSpring);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="today-add"
        style={styles.fabTouch}
      >
        <Icon name="plus" size={28} color={theme.background} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  headerText: { flex: 1, gap: 2 },
  greeting: { fontSize: 28, lineHeight: 36 },
  date: { fontSize: 15 },
  body: { paddingHorizontal: 18, marginTop: -26, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
  card: { borderRadius: 22, borderWidth: 1, boxShadow: '0 10px 26px rgba(18,47,32,0.08)' },
  progressCard: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  progressText: { fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groups: { gap: 12 },
  group: { gap: 6 },
  groupTitle: { fontFamily: 'Manrope_600SemiBold', paddingHorizontal: 6 },
  list: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 10px 26px rgba(18,47,32,0.06)',
  },
  empty: { alignItems: 'center', padding: 22, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, textAlign: 'center' },
  emptyBody: { textAlign: 'center', maxWidth: 290, marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    boxShadow: '0 10px 22px rgba(29,70,48,0.35)',
  },
  fabTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
