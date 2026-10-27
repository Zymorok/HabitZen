import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  addCalendarDays,
  dateInTimeZone,
  isoWeekday,
  localDate,
  startOfIsoWeek,
} from '@habitzen/core/calendar';
import type { LocalDate } from '@habitzen/core/calendar';
import { formatDateRange, weekdayLabels } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { CountUp } from '../../../shared/motion/CountUp';
import { habitArt } from '../../../shared/habit-art';
import { habitColor } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { amountText } from '../../habits/goal';
import { useStreak } from '../../today/data/usePlan';
import type { WeekHabit } from '../data/progress-api';
import { useCalendarDays, useWeekSummary } from '../data/useProgress';
import { WeekBars } from '../components/WeekBars';
import { bestDay, habitWeekLine, weekDelta, weekSummary } from '../stats';

const WEEKS_BACK = 52;

function deviceToday(): LocalDate {
  return dateInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * «Итоги недели» (HZ-08): процент выполненного с досчитывающим числом, сравнение с прошлой
 * неделей, минуты фокуса, лучший день, столбики и строка по каждой привычке.
 * NOTE: Открывается с «Прогресса» на той неделе, что выбрана в календаре; листается назад на год.
 */
export function WeekSummaryScreen() {
  const params = useLocalSearchParams<{ start?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['progress', 'habits', 'common', 'errors']);
  const locale = i18n.language as SupportedLocale;
  const { theme, night, isDark, palette } = useAppPreferences();
  const streak = useStreak();
  const today = localDate(streak.data?.today ?? deviceToday());
  const currentWeek = startOfIsoWeek(today);
  const firstWeek = addCalendarDays(currentWeek, -WEEKS_BACK * 7);
  const [weekStart, setWeekStart] = useState<LocalDate>(() => {
    const start = params.start ? startOfIsoWeek(localDate(params.start)) : currentWeek;
    return start > currentWeek ? currentWeek : start;
  });
  const weekEnd = addCalendarDays(weekStart, 6);
  const previousStart = addCalendarDays(weekStart, -7);
  const summary = useWeekSummary(weekStart);
  const calendar = useCalendarDays(previousStart, weekEnd);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);

  const days = calendar.data ?? [];
  const current = weekSummary(days, weekStart, today);
  const previous = weekSummary(days, previousStart, today);
  const delta = weekDelta(current.percent, previous.percent);
  const best = bestDay(current.bars);
  const habits = summary.data?.habits ?? [];
  const completed = habits.reduce((sum, habit) => sum + habit.completed, 0);
  const loading = summary.isPending || calendar.isPending;

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const step = (direction: -1 | 1) =>
    setWeekStart((start) => {
      const next = addCalendarDays(start, direction * 7);
      return next < firstWeek || next > currentWeek ? start : next;
    });

  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="week-summary-screen"
    >
      <View className="flex-row items-center px-2.5">
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="week-back"
        >
          <View style={styles.flip}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="button" style={styles.topTitle}>
          {t('progress:week_summary')}
        </ThemedText>
        <View className="w-11" />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 12 },
        ]}
      >
        <View className="flex-row items-center">
          <IconButton
            accessibilityLabel={t('progress:week_prev')}
            onPress={() => step(-1)}
            testID="week-prev"
          >
            <View style={styles.flip}>
              <Icon name="arrow" color={weekStart > firstWeek ? theme.text : theme.border} />
            </View>
          </IconButton>
          <View className="flex-1 items-center">
            <AppText style={[styles.rangeLabel, { color: theme.textMuted }]}>
              {weekStart === currentWeek
                ? t('progress:this_week')
                : weekStart === addCalendarDays(currentWeek, -7)
                  ? t('progress:last_week')
                  : ' '}
            </AppText>
            <ThemedText variant="title" style={styles.range} testID="week-range">
              {formatDateRange(weekStart, weekEnd, locale)}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t('progress:week_next')}
            onPress={() => step(1)}
            testID="week-next"
          >
            <Icon name="arrow" color={weekStart < currentWeek ? theme.text : theme.border} />
          </IconButton>
        </View>

        {summary.isError ? (
          <View className="items-center justify-center gap-3 py-10">
            <AppText style={{ color: theme.error, textAlign: 'center' }}>
              {t(errorMessageKey(summary.error))}
            </AppText>
            <Button
              label={t('common:retry')}
              variant="outline"
              onPress={() => void summary.refetch()}
            />
          </View>
        ) : loading ? (
          <View className="items-center justify-center gap-3 py-10">
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <Animated.View key={weekStart} entering={FadeIn.duration(320)} style={styles.section}>
            <Animated.View entering={FadeInDown.duration(380)}>
              <LinearGradient
                // NOTE: Карточка в цвете темы; ночью — приглушённая, чтобы белый текст читался.
                colors={
                  isDark
                    ? [palette.dark.primarySoft, palette.dark.surface]
                    : [palette.gradient.day[0], palette.gradient.day[1]]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <CountUp
                  value={Math.round((current.percent ?? 0) * 100)}
                  format={(value) => (current.percent === null ? '—' : `${value}%`)}
                  style={styles.heroValue}
                  testID="week-percent"
                />
                <AppText style={styles.heroCaption}>{t('progress:week_done_caption')}</AppText>
                <View style={styles.deltaChip} testID="week-delta">
                  {delta !== null && delta !== 0 ? (
                    // NOTE: Стрелка вверх — лучше прошлой недели, вниз — хуже.
                    <View style={{ transform: [{ rotate: delta > 0 ? '-90deg' : '90deg' }] }}>
                      <Icon name="arrow" size={14} color="#FFFDF3" strokeWidth={2.4} />
                    </View>
                  ) : null}
                  <AppText style={styles.deltaText}>
                    {delta === null
                      ? t('progress:delta_none')
                      : delta === 0
                        ? t('progress:delta_same')
                        : t(delta > 0 ? 'progress:delta_up' : 'progress:delta_down', {
                            value: Math.abs(delta),
                          })}
                  </AppText>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* NOTE: Плитки — классы NativeWind (HZ-11). */}
            <View className="flex-row gap-2.5">
              <Tile
                icon="check"
                value={completed}
                caption={t('progress:completions_caption', { count: completed })}
                testID="week-completed"
              />
              <Tile
                icon="timer"
                value={summary.data?.focusMinutes ?? 0}
                caption={t('progress:focus_minutes_caption', {
                  count: summary.data?.focusMinutes ?? 0,
                })}
                testID="week-focus"
              />
              <Tile
                icon="crown"
                text={best ? (weekdays[isoWeekday(best)] ?? '—') : '—'}
                caption={t('progress:best_day_caption')}
                testID="week-best"
              />
            </View>

            <AppText style={styles.sectionTitle}>{t('progress:week_activity')}</AppText>
            <WeekBars
              testID="week-summary-bars"
              bars={current.bars.map((bar, index) => ({
                key: bar.date,
                value: bar.share,
                future: bar.future,
                strong: bar.date === best,
                label: weekdays[index] ?? '',
              }))}
            />

            <AppText style={styles.sectionTitle}>{t('progress:habits_title')}</AppText>
            {habits.length === 0 ? (
              <AppText style={{ color: theme.textMuted }} testID="week-empty">
                {t('progress:week_empty')}
              </AppText>
            ) : (
              <View
                className="overflow-hidden rounded-card border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                {habits.map((habit, index) => (
                  <HabitLine key={habit.habitId} habit={habit} index={index} />
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Tile({
  icon,
  value,
  text,
  caption,
  testID,
}: {
  readonly icon: 'check' | 'timer' | 'crown';
  readonly value?: number;
  readonly text?: string;
  readonly caption: string;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  return (
    <View
      className="flex-1 gap-1 rounded-[18px] border p-3"
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      testID={testID}
    >
      <Icon name={icon} size={18} color={theme.primary} strokeWidth={2} />
      {value === undefined ? (
        <AppText style={styles.tileValue}>{text}</AppText>
      ) : (
        <CountUp value={value} style={styles.tileValue} />
      )}
      <AppText
        className="self-stretch"
        style={{ color: theme.textMuted, fontSize: 12, lineHeight: 16 }}
        numberOfLines={2}
      >
        {caption}
      </AppText>
    </View>
  );
}

/** Привычка недели: значок, название, полоска и «5 из 7»; у количества — «всего 38 стаканов». */
function HabitLine({ habit, index }: { readonly habit: WeekHabit; readonly index: number }) {
  const { t, i18n } = useTranslation(['progress', 'habits']);
  const { theme } = useAppPreferences();
  const line = habitWeekLine(habit);
  // NOTE: Единица «раз» — обычная отметка; стаканы, минуты и шаги показываем суммой за неделю.
  const count = habit.goalUnit !== 'times';
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={[
        styles.habit,
        index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : null,
      ]}
      testID="week-habit"
    >
      <Image
        source={habitArt(habit.iconKey)}
        style={{ width: 32, height: 32 }}
        resizeMode="contain"
        accessible={false}
      />
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <AppText style={styles.habitTitle} numberOfLines={1}>
            {habit.title}
          </AppText>
          <AppText style={[styles.ratio, { color: theme.success }]} testID="week-habit-ratio">
            {`${line.done}/${line.total}`}
          </AppText>
        </View>
        <View
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.surfaceMuted }}
        >
          <View
            style={[
              styles.bar,
              { width: `${line.share * 100}%`, backgroundColor: habitColor(habit.colorKey) },
            ]}
          />
        </View>
        {count || habit.perWeek ? (
          <AppText variant="small" style={{ color: theme.textMuted }} numberOfLines={1}>
            {[
              habit.perWeek ? t('progress:week_goal', { count: habit.perWeek }) : null,
              count
                ? t('progress:week_total', {
                    amount: amountText(t, i18n.language, habit.progress, habit.goalUnit),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  flip: { transform: [{ scaleX: -1 }] },
  content: { paddingHorizontal: 18, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  rangeLabel: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  range: { fontSize: 22, lineHeight: 30, textAlign: 'center' },
  section: { gap: 14 },
  hero: { borderRadius: 24, padding: 20, alignItems: 'center', gap: 2 },
  heroValue: {
    color: '#FFFDF3',
    fontFamily: 'Manrope_700Bold',
    fontSize: 54,
    lineHeight: 64,
    letterSpacing: -1,
  },
  heroCaption: { color: '#E4F0DC', fontSize: 15, alignSelf: 'stretch', textAlign: 'center' },
  deltaChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,253,243,0.16)',
  },
  deltaText: { color: '#FFFDF3', fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
  tileValue: { fontFamily: 'Manrope_700Bold', fontSize: 24, lineHeight: 30, alignSelf: 'stretch' },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, marginTop: 4 },
  habit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  habitTitle: { flex: 1, fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  ratio: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  bar: { height: '100%', borderRadius: 3 },
});
