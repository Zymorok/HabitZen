import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  addCalendarDays,
  dateInTimeZone,
  localDate,
  monthDays,
  shiftMonth,
  startOfIsoWeek,
} from '@habitzen/core/calendar';
import type { LocalDate } from '@habitzen/core/calendar';
import {
  formatCalendarDate,
  formatMonthTitle,
  formatPercent,
  weekdayLabels,
} from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { habitColor, habitIcon } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useActiveHabits } from '../../habits/data/useHabits';
import { useStreak } from '../../today/data/usePlan';
import { MAX_FREEZES } from '@habitzen/core/streaks';
import { useCalendarDays } from '../data/useProgress';
import { MonthGrid } from '../components/MonthGrid';
import { WeekBars } from '../components/WeekBars';
import { YearMap } from '../components/YearMap';
import { useAchievements } from '../../achievements/useAchievements';
import { dayShare, totalCompleted, weekSummary, yearGrid } from '../stats';

const MONTHS_BACK = 12;

function deviceToday(): LocalDate {
  return dateInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * Кадр 08 «Прогресс»: месяц с насыщенностью цвета по выполнению, карточка выбранного дня,
 * активность недели, серия, выполнения за месяц и процент недели. Ниже — привычки,
 * из которых открывается их статистика (кадр 09).
 */
export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, i18n } = useTranslation(['progress', 'errors', 'common']);
  const locale = i18n.language as SupportedLocale;
  const { theme, night, palette } = useAppPreferences();
  const streak = useStreak();
  const habits = useActiveHabits();
  // NOTE: «Сегодня» — по поясу профиля с сервера; часы телефона — только пока он не ответил.
  const today = localDate(streak.data?.today ?? deviceToday());
  const frozen = useMemo(() => new Set<string>(streak.data?.frozen ?? []), [streak.data?.frozen]);
  const [month, setMonth] = useState<LocalDate>(() => shiftMonth(today, 0));
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const currentMonth = shiftMonth(today, 0);
  const firstMonth = shiftMonth(today, -MONTHS_BACK);

  const dates = monthDays(month);
  const monthStart = dates[0]!;
  const monthEnd = dates[dates.length - 1]!;
  const from = startOfIsoWeek(monthStart);
  const to = addCalendarDays(startOfIsoWeek(monthEnd), 6);
  const calendar = useCalendarDays(from, to);
  const days = useMemo(
    () => new Map((calendar.data ?? []).map((day) => [day.date, day])),
    [calendar.data],
  );
  // NOTE: Без выбора показывается сегодняшний день, а в прошлом месяце — его последний день.
  const selected =
    picked && picked >= monthStart && picked <= monthEnd
      ? picked
      : today >= monthStart && today <= monthEnd
        ? today
        : monthEnd;
  const selectedDay = days.get(selected);
  const week = weekSummary(calendar.data ?? [], startOfIsoWeek(selected), today);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const completedInMonth = totalCompleted(calendar.data ?? [], monthStart, monthEnd);
  const gridWidth = Math.min(width, 520) - 32;
  // NOTE: Годовая карта (HZ-08) — отдельный запрос за 53 недели, независимый от месяца.
  const yearStart = addCalendarDays(startOfIsoWeek(today), -52 * 7);
  const year = useCalendarDays(yearStart, today);
  const achievements = useAchievements();
  const achieved = achievements?.filter((item) => item.unlocked).length ?? 0;
  const grid = useMemo(() => yearGrid(year.data ?? [], today), [year.data, today]);

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const changeMonth = (step: -1 | 1) => {
    setDirection(step);
    setPicked(null);
    setMonth((current) => shiftMonth(current, step));
  };
  const onSelect = useCallback((date: LocalDate) => setPicked(date), []);

  const share = dayShare(selectedDay);
  // NOTE: Пока данные месяца не пришли, не говорим «истории нет» и не показываем нули.
  const loading = calendar.isPending;
  const dayStatus = loading
    ? t('common:loading')
    : selected > today
      ? t('progress:day_future')
      : !selectedDay
        ? t('progress:day_empty')
        : share === null
          ? t('progress:day_rest')
          : t('progress:day_progress', {
              completed: selectedDay.completed,
              total: selectedDay.planned - selectedDay.skipped,
            }) + (frozen.has(selected) ? `. ${t('progress:day_frozen')}` : '');

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="progress-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 14) + 4, maxWidth: 520 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={calendar.isRefetching}
            onRefresh={() => {
              void calendar.refetch();
              void streak.refetch();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.monthHeader}>
          <IconButton
            accessibilityLabel={t('progress:prev_month')}
            onPress={() => {
              if (month > firstMonth) changeMonth(-1);
            }}
            testID="month-prev"
          >
            <View style={styles.flip}>
              <Icon name="arrow" color={month > firstMonth ? theme.text : theme.border} />
            </View>
          </IconButton>
          <ThemedText variant="title" style={styles.monthTitle} testID="month-title">
            {formatMonthTitle(month, locale, month.slice(0, 4) !== today.slice(0, 4))}
          </ThemedText>
          <IconButton
            accessibilityLabel={t('progress:next_month')}
            onPress={() => {
              if (month < currentMonth) changeMonth(1);
            }}
            testID="month-next"
          >
            <Icon name="arrow" color={month < currentMonth ? theme.text : theme.border} />
          </IconButton>
        </View>

        {calendar.isError ? (
          <View style={styles.center}>
            <AppText style={{ color: theme.error, textAlign: 'center' }} testID="progress-error">
              {t(errorMessageKey(calendar.error))}
            </AppText>
            <Button
              label={t('common:retry')}
              variant="outline"
              onPress={() => void calendar.refetch()}
            />
          </View>
        ) : (
          <>
            <MonthGrid
              month={month}
              direction={direction}
              days={days}
              today={today}
              selected={selected}
              width={gridWidth}
              weekdays={weekdays}
              onSelect={onSelect}
              frozen={frozen}
            />
            {calendar.isPending ? <ActivityIndicator color={theme.primary} /> : null}

            <Animated.View
              key={selected}
              entering={FadeIn.duration(260)}
              style={[styles.dayCard, { backgroundColor: theme.surfaceMuted }]}
              testID="day-card"
            >
              <View style={[styles.dayIcon, { backgroundColor: theme.primary }]}>
                <Icon name="calendar" size={22} color={theme.background} strokeWidth={2} />
              </View>
              <View style={styles.dayText}>
                <AppText style={styles.dayTitle}>{formatCalendarDate(selected, locale)}</AppText>
                <AppText style={{ color: theme.textMuted }} testID="day-status">
                  {dayStatus}
                </AppText>
              </View>
            </Animated.View>

            <AppText style={styles.sectionTitle}>{t('progress:week_activity')}</AppText>
            <WeekBars
              testID="week-bars"
              bars={week.bars.map((bar, index) => ({
                key: bar.date,
                value: bar.share,
                future: bar.future,
                strong: bar.date === selected,
                label: weekdays[index] ?? '',
              }))}
            />

            <View style={[styles.stats, { borderColor: theme.border }]} testID="progress-stats">
              <Stat
                value={streak.isPending ? '—' : String(streak.data?.current ?? 0)}
                caption={t('progress:streak_caption', { count: streak.data?.current ?? 0 })}
                testID="stat-streak"
              />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Stat
                value={loading ? '—' : String(completedInMonth)}
                caption={t('progress:completions_caption', { count: completedInMonth })}
                testID="stat-completed"
              />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Stat
                value={week.percent === null ? '—' : formatPercent(week.percent, locale)}
                caption={t('progress:week_percent_caption')}
                testID="stat-week"
              />
            </View>
            {streak.data ? (
              <FreezeCard freezes={streak.data.freezes} nextIn={streak.data.nextFreezeIn} />
            ) : null}

            <Pressable
              onPress={() =>
                router.push({ pathname: '/week', params: { start: startOfIsoWeek(selected) } })
              }
              accessibilityRole="button"
              accessibilityLabel={t('progress:week_summary')}
              testID="open-week"
              style={[
                styles.weekLink,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.weekLinkIcon, { backgroundColor: theme.surfaceMuted }]}>
                <Icon name="chart" size={20} color={theme.primary} strokeWidth={2} />
              </View>
              <View style={styles.dayText}>
                <AppText style={styles.weekLinkTitle}>{t('progress:week_summary')}</AppText>
                <AppText variant="small" style={{ color: theme.textMuted }}>
                  {t('progress:week_summary_hint')}
                </AppText>
              </View>
              <Icon name="arrow" size={18} color={theme.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/achievements')}
              accessibilityRole="button"
              accessibilityLabel={t('progress:achievements_title')}
              testID="open-achievements"
              style={[
                styles.weekLink,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.weekLinkIcon, styles.trophyIcon]}>
                <Icon name="trophy" size={20} color="#FFFDF3" strokeWidth={2} />
              </View>
              <View style={styles.dayText}>
                <AppText style={styles.weekLinkTitle}>{t('progress:achievements_title')}</AppText>
                <AppText
                  variant="small"
                  style={{ color: theme.textMuted }}
                  testID="achievements-short"
                >
                  {achievements
                    ? t('progress:achievements_count', {
                        done: achieved,
                        total: achievements.length,
                      })
                    : ' '}
                </AppText>
              </View>
              <Icon name="arrow" size={18} color={theme.textMuted} />
            </Pressable>

            <View style={styles.yearHead}>
              <AppText style={styles.sectionTitle}>{t('progress:year_title')}</AppText>
              <AppText variant="small" style={{ color: theme.textMuted }} testID="year-active">
                {year.isPending ? ' ' : t('progress:year_active', { count: grid.activeDays })}
              </AppText>
            </View>
            <View testID="year-map">
              <YearMap
                columns={grid.columns}
                months={grid.months}
                frozen={frozen}
                width={gridWidth}
              />
            </View>
          </>
        )}

        <AppText style={styles.sectionTitle}>{t('progress:habits_title')}</AppText>
        {(habits.data ?? []).length === 0 ? (
          <AppText style={{ color: theme.textMuted }}>{t('progress:habits_empty')}</AppText>
        ) : (
          <View
            style={[
              styles.habitList,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {(habits.data ?? []).map((habit, index) => (
              <Animated.View key={habit.id} entering={FadeInDown.delay(index * 40).duration(300)}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/habit/stats/[habitId]',
                      params: { habitId: habit.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('progress:open_habit', { title: habit.title })}
                  testID="progress-habit"
                  style={[
                    styles.habitRow,
                    index > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
                      : null,
                  ]}
                >
                  <View style={[styles.habitIcon, { backgroundColor: habitColor(habit.colorKey) }]}>
                    <Icon
                      name={habitIcon(habit.iconKey)}
                      size={20}
                      color="#FFFDF3"
                      strokeWidth={2}
                    />
                  </View>
                  <AppText style={styles.habitTitle} numberOfLines={1}>
                    {habit.title}
                  </AppText>
                  <Icon name="arrow" size={18} color={theme.textMuted} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Stat({
  value,
  caption,
  testID,
}: {
  readonly value: string;
  readonly caption: string;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  return (
    <Animated.View key={value} entering={FadeIn.duration(300)} style={styles.stat} testID={testID}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={[styles.statCaption, { color: theme.textMuted }]} numberOfLines={2}>
        {caption}
      </AppText>
    </Animated.View>
  );
}

/** Заморозка серии (HZ-08): сколько в запасе и сколько дней до следующей. */
function FreezeCard({ freezes, nextIn }: { readonly freezes: number; readonly nextIn: number }) {
  const { t } = useTranslation('progress');
  const { isDark } = useAppPreferences();
  const ice = isDark
    ? { bg: '#22394A', icon: '#9CC3DF', text: '#D8E9F5', muted: '#A9C3D6' }
    : { bg: '#E6F0F7', icon: '#3F6F92', text: '#1F4560', muted: '#4B6F88' };
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.freezeCard, { backgroundColor: ice.bg }]}
      testID="freeze-card"
    >
      <View style={styles.freezeIcons}>
        {Array.from({ length: MAX_FREEZES }, (_, index) => (
          // NOTE: Пустые места запаса — бледные снежинки: видно, сколько ещё можно накопить.
          <View key={index} style={{ opacity: index < freezes ? 1 : 0.3 }}>
            <Icon name="snowflake" size={22} color={ice.icon} strokeWidth={2} />
          </View>
        ))}
      </View>
      <View style={styles.dayText}>
        <AppText style={[styles.freezeTitle, { color: ice.text }]} testID="freeze-stock">
          {t('freeze_stock', { count: freezes, max: MAX_FREEZES })}
        </AppText>
        <AppText variant="small" style={{ color: ice.muted }}>
          {nextIn === 0 ? t('freeze_full') : t('freeze_next', { count: nextIn })}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
    width: '100%',
    alignSelf: 'center',
  },
  center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flip: { transform: [{ scaleX: -1 }] },
  monthTitle: { fontSize: 24, lineHeight: 32, textAlign: 'center', flex: 1 },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  dayIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { flex: 1, gap: 2 },
  dayTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 17, lineHeight: 24 },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, marginTop: 6 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    lineHeight: 36,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  // WARNING: Подпись растянута на всю колонку: на Android текст «по размеру содержимого»
  // иногда измеряется уже, чем рисуется, и вторая строка обрезается.
  statCaption: { fontSize: 13, lineHeight: 17, textAlign: 'center', alignSelf: 'stretch' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6 },
  weekLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  weekLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLinkTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  trophyIcon: { backgroundColor: '#E39A3B' },
  yearHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  freezeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  freezeIcons: { flexDirection: 'row', gap: 2 },
  freezeTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  habitList: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 60 },
  habitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitTitle: { flex: 1, fontFamily: 'Manrope_600SemiBold' },
});
