import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
import { useActiveHabits, useArchiveHabit, useReorderHabits } from '../../habits/data/useHabits';
import { SortableList } from '../../habits/components/SortableList';
import { mergeOrder } from '../../habits/order';
import { habitArt } from '../../../shared/habit-art';
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
import { DayCard } from '../components/DayCard';
import { AchievementToast } from '../../achievements/components/AchievementToast';
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
  const reorder = useReorderHabits();
  // NOTE: Режим «Порядок» (HZ-10): строки тянут за «≡» прямо в плане, внутри своего раздела.
  const [ordering, setOrdering] = useState(false);
  const [dragging, setDragging] = useState(false);
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
    if (items.length > 1)
      list.push({
        key: 'order',
        label: t('habits:order_mode'),
        icon: 'menu',
        onPress: () => setOrdering(true),
      });
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
        scrollEnabled={!dragging}
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
              <DayCard
                completed={progress.completed}
                total={progress.total}
                allDone={progress.allDone}
                date={date}
                onWeekPress={() => router.push('/progress')}
              />
              {items.length > 1 ? (
                <View className="-mb-1 flex-row items-center gap-2.5">
                  {ordering ? (
                    <AppText variant="small" style={[styles.orderHint, { color: theme.textMuted }]}>
                      {t('habits:order_hint_short')}
                    </AppText>
                  ) : (
                    <View className="flex-1" />
                  )}
                  <Pressable
                    onPress={() => setOrdering((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ordering }}
                    hitSlop={8}
                    testID={ordering ? 'today-order-done' : 'today-order'}
                    style={[
                      styles.orderButton,
                      ordering
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.surfaceMuted },
                    ]}
                  >
                    <Icon
                      name={ordering ? 'check' : 'menu'}
                      size={15}
                      color={ordering ? theme.background : theme.primary}
                      strokeWidth={2.2}
                    />
                    <AppText
                      variant="small"
                      style={[
                        styles.orderText,
                        { color: ordering ? theme.background : theme.primary },
                      ]}
                    >
                      {ordering ? t('habits:order_done') : t('habits:order_mode')}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
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
                      {ordering ? (
                        <SortableList
                          ids={group.items.map((item) => item.itemId)}
                          rowHeight={60}
                          onDragging={setDragging}
                          onReorder={(itemIds) => {
                            const habitIds = itemIds.flatMap((itemId) => {
                              const found = group.items.find((item) => item.itemId === itemId);
                              return found ? [found.habitId] : [];
                            });
                            const all = (habits.data ?? []).map((habit) => habit.id);
                            setActionError(null);
                            reorder.mutate(
                              { ids: mergeOrder(all, habitIds), requestId: newRequestId() },
                              { onError: (error) => setActionError(t(errorMessageKey(error))) },
                            );
                          }}
                          moveUpLabel={t('habits:move_up')}
                          moveDownLabel={t('habits:move_down')}
                          handleLabel={(itemId) =>
                            t('habits:drag_habit', {
                              title:
                                group.items.find((item) => item.itemId === itemId)?.title ?? '',
                            })
                          }
                          renderRow={(itemId) => {
                            const item = group.items.find((entry) => entry.itemId === itemId);
                            return item ? (
                              <OrderRow title={item.title} iconKey={item.iconKey} />
                            ) : null;
                          }}
                        />
                      ) : null}
                      {ordering
                        ? null
                        : group.items.map((item, index) => (
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
                                  router.push({
                                    pathname: '/done',
                                    params: { itemId: item.itemId },
                                  }),
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
      {/* NOTE: «Новое достижение!» (HZ-10) выезжает поверх экрана один раз. */}
      <AchievementToast />
      <RowMenu
        title={menuItem?.title ?? ''}
        visible={menuItem !== null}
        actions={menuItem ? menuActions(menuItem) : []}
        onClose={() => setMenuItem(null)}
      />
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

/** Строка в режиме «Порядок»: только значок и название — нажатия и свайпы отключены. */
function OrderRow({ title, iconKey }: { readonly title: string; readonly iconKey: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-3 pr-3.5" testID="order-row">
      <Image source={habitArt(iconKey)} className="h-[30px] w-[30px]" resizeMode="contain" />
      <AppText numberOfLines={1} style={styles.orderTitle}>
        {title}
      </AppText>
    </View>
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
  groups: { gap: 12 },
  orderHint: { flex: 1, paddingHorizontal: 6 },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  orderText: { fontFamily: 'Manrope_600SemiBold' },
  orderTitle: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15 },
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
