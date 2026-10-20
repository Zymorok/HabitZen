import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { localDate, startOfIsoWeek } from '@habitzen/core/calendar';
import { formatCalendarDate, weekdayLabels } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { habitColor, habitIcon } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { RowMenu } from '../../../shared/ui/RowMenu';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { useActiveHabits, useArchiveHabit } from '../../habits/data/useHabits';
import type { HabitDay, HabitDayStatus } from '../data/progress-api';
import { useHabitDays } from '../data/useProgress';
import { WeekBars } from '../components/WeekBars';
import { habitDayShare, habitStreak, habitWeek } from '../stats';
import Svg, { Circle } from 'react-native-svg';
import { goalOfText } from '../../habits/goal';
import type { GoalUnit } from '../../habits/goal';

const RECENT = 5;
const HISTORY = 60;

/**
 * Кадр 09: статистика одной привычки — лучшая серия, выполнения за неделю, последние дни
 * и вкладка «История». Кнопка внизу открывает изменение привычки (кадр 03).
 */
export function HabitStatsScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['progress', 'habits', 'common', 'errors']);
  const locale = i18n.language as SupportedLocale;
  const { theme, night, palette } = useAppPreferences();
  const habits = useActiveHabits();
  const archive = useArchiveHabit();
  const history = useHabitDays(habitId);
  const habit = habits.data?.find((entry) => entry.id === habitId);
  const [tab, setTab] = useState<'stats' | 'history'>('stats');
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));

  const days = useMemo(() => history.data ?? [], [history.data]);
  const streak = useMemo(() => habitStreak(days), [days]);
  const today = days[0] ? localDate(days[0].date) : null;
  const week = today ? habitWeek(days, startOfIsoWeek(today), today) : null;

  if (habits.isPending || history.isPending) {
    return (
      <View style={[styles.shell, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (!habit || history.isError) {
    return (
      <View
        style={[styles.shell, styles.center, { backgroundColor: theme.background, padding: 24 }]}
        testID="habit-stats-missing"
      >
        <AppText style={{ color: theme.textMuted, textAlign: 'center' }}>
          {history.isError ? t(errorMessageKey(history.error)) : t('progress:habit_missing')}
        </AppText>
        <Button label={t('common:back')} variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  const color = habitColor(habit.colorKey);
  const edit = () => router.push({ pathname: '/habit/new', params: { id: habit.id } });

  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="habit-stats-screen"
    >
      <View style={styles.topBar}>
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="habit-stats-back"
        >
          <View style={styles.flip}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <IconButton
          accessibilityLabel={t('habits:menu')}
          onPress={() => setMenu(true)}
          testID="habit-stats-menu"
        >
          <Icon name="more" color={theme.text} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(360)} style={styles.hero}>
          <View style={[styles.bigIcon, { backgroundColor: color }]}>
            <Icon name={habitIcon(habit.iconKey)} size={38} color="#FFFDF3" strokeWidth={1.9} />
          </View>
          <View style={styles.heroText}>
            <View style={styles.titleRow}>
              <ThemedText
                variant="title"
                style={styles.title}
                numberOfLines={2}
                testID="habit-stats-title"
              >
                {habit.title}
              </ThemedText>
              <IconButton accessibilityLabel={t('habits:edit_habit')} onPress={edit}>
                <Icon name="pencil" color={theme.text} />
              </IconButton>
            </View>
            <View style={styles.chip} testID="habit-best-streak">
              <Icon name="crown" size={16} color="#E39A3B" fill="#F6C66B" strokeWidth={1.6} />
              <AppText style={styles.chipText}>
                {t('progress:best_streak_chip', { count: streak.best })}
              </AppText>
            </View>
          </View>
        </Animated.View>

        <Segmented
          value={tab}
          options={[
            { key: 'stats', label: t('progress:tab_stats') },
            { key: 'history', label: t('progress:tab_history') },
          ]}
          onChange={setTab}
        />

        {tab === 'stats' ? (
          <Animated.View key="stats" entering={FadeIn.duration(260)} style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText style={[styles.sectionTitle, styles.grow]}>
                {t('progress:week_completions')}
              </AppText>
              <AppText style={[styles.ratio, { color: theme.success }]} testID="habit-week-ratio">
                {week ? `${week.done}/${week.planned}` : '0/0'}
              </AppText>
            </View>
            {week ? (
              <WeekBars
                height={86}
                testID="habit-week-bars"
                bars={week.marks.map((mark, index) => ({
                  key: mark.date,
                  // NOTE: Частично набранный день (HZ-09) — столбик по доле цели, не ниже пропуска.
                  value:
                    mark.status === 'completed'
                      ? 1
                      : mark.status === 'rest' || mark.status === null
                        ? null
                        : Math.max(0.3, shareOf(days, mark.date)),
                  future: mark.future,
                  strong: mark.date === today,
                  label: weekdays[index] ?? '',
                }))}
              />
            ) : null}
            <AppText style={styles.sectionTitle}>{t('progress:recent_days')}</AppText>
            <DayList days={days.slice(0, RECENT)} unit={habit.goalUnit} color={color} />
          </Animated.View>
        ) : (
          <Animated.View key="history" entering={FadeIn.duration(260)} style={styles.section}>
            <AppText style={{ color: theme.textMuted }} testID="habit-history-total">
              {t('progress:history_total', {
                done: days.filter((day) => day.status === 'completed').length,
                total: days.filter((day) => day.status !== 'rest').length,
              })}
            </AppText>
            <DayList days={days.slice(0, HISTORY)} unit={habit.goalUnit} color={color} />
          </Animated.View>
        )}
        {error ? (
          <AppText variant="small" style={{ color: theme.error, textAlign: 'center' }}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Button label={t('habits:edit_habit')} onPress={edit} testID="habit-stats-edit" />
      </View>

      <RowMenu
        title={habit.title}
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { key: 'edit', label: t('habits:edit_habit'), icon: 'pencil', onPress: edit },
          {
            key: 'archive',
            label: t('habits:archive'),
            icon: 'archive',
            danger: true,
            onPress: () =>
              archive.mutate(
                { habit, requestId: newRequestId() },
                {
                  onSuccess: () => router.back(),
                  onError: (failure) => setError(t(errorMessageKey(failure))),
                },
              ),
          },
        ]}
      />
    </Animated.View>
  );
}

const STATUS_LOOK: Readonly<Record<HabitDayStatus, { icon: IconName | null; key: string }>> = {
  completed: { icon: 'check', key: 'completed' },
  missed: { icon: null, key: 'missed' },
  skipped: { icon: 'moon', key: 'skipped' },
  pending: { icon: 'clock', key: 'pending' },
  rest: { icon: null, key: 'rest' },
};

function shareOf(days: readonly HabitDay[], date: string): number {
  const day = days.find((entry) => entry.date === date);
  return day ? habitDayShare(day) : 0;
}

/**
 * Список дней: зелёная галочка — выполнено, пустой кружок — пропущено (как на макете).
 * NOTE: С HZ-09 частично набранный день — кольцо по доле цели и «5 из 8 стаканов».
 */
function DayList({
  days,
  unit,
  color,
}: {
  readonly days: readonly HabitDay[];
  readonly unit: GoalUnit;
  readonly color: string;
}) {
  const { t, i18n } = useTranslation(['progress', 'habits']);
  const { theme } = useAppPreferences();
  return (
    <View testID="habit-days">
      {days.map((day, index) => {
        const look = STATUS_LOOK[day.status];
        const done = day.status === 'completed';
        const share = habitDayShare(day);
        const partial = !done && share > 0;
        return (
          <Animated.View
            key={day.date}
            entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}
            style={[
              styles.dayRow,
              index > 0
                ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
                : null,
            ]}
            testID="habit-day"
          >
            {partial ? (
              <PartialMark share={share} color={color} track={theme.border} />
            ) : (
              <View
                style={[
                  styles.mark,
                  done
                    ? { backgroundColor: theme.success, borderColor: theme.success }
                    : { borderColor: day.status === 'rest' ? theme.border : theme.textMuted },
                ]}
              >
                {look.icon ? (
                  <Icon
                    name={look.icon}
                    size={done ? 15 : 13}
                    color={done ? '#FFFDF3' : theme.textMuted}
                    strokeWidth={done ? 2.6 : 1.8}
                  />
                ) : null}
              </View>
            )}
            <AppText style={styles.dayDate}>
              {formatCalendarDate(localDate(day.date), i18n.language as SupportedLocale)}
            </AppText>
            <AppText style={[styles.dayStatus, { color: theme.textMuted }]}>
              {partial
                ? t('habits:progress_of', {
                    done: day.progress,
                    goal: goalOfText(t, i18n.language, day.target, unit),
                  })
                : t(`progress:${look.key}`)}
            </AppText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const MARK = 24;
const MARK_STROKE = 2.5;
const MARK_RADIUS = (MARK - MARK_STROKE) / 2;
const MARK_LENGTH = 2 * Math.PI * MARK_RADIUS;

/** Кольцо частичного дня: заполнено на долю цели цветом привычки. */
function PartialMark({
  share,
  color,
  track,
}: {
  readonly share: number;
  readonly color: string;
  readonly track: string;
}) {
  return (
    <Svg width={MARK} height={MARK} testID="habit-day-partial">
      <Circle
        cx={MARK / 2}
        cy={MARK / 2}
        r={MARK_RADIUS}
        strokeWidth={MARK_STROKE}
        fill="none"
        stroke={track}
      />
      <Circle
        cx={MARK / 2}
        cy={MARK / 2}
        r={MARK_RADIUS}
        strokeWidth={MARK_STROKE}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={`${MARK_LENGTH * share} ${MARK_LENGTH}`}
        transform={`rotate(-90 ${MARK / 2} ${MARK / 2})`}
      />
    </Svg>
  );
}

/** Переключатель «Статистика | История» с подчёркиванием, которое переезжает пружиной. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly { readonly key: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  const { theme } = useAppPreferences();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withSpring(index, motion.spring);
  }, [index, offset]);
  const segment = width / options.length;
  const pillStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: offset.value * segment }],
  }));
  return (
    <View
      style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8)}
      accessibilityRole="tablist"
    >
      {width > 0 ? (
        <Animated.View style={[styles.pill, { backgroundColor: theme.surface }, pillStyle]}>
          <View style={[styles.underline, { backgroundColor: theme.primary }]} />
        </Animated.View>
      ) : null}
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onChange(option.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.key === value }}
          testID={`habit-tab-${option.key}`}
          style={styles.segment}
        >
          <AppText
            style={[
              styles.segmentLabel,
              { color: option.key === value ? theme.text : theme.textMuted },
            ]}
          >
            {option.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  flip: { transform: [{ scaleX: -1 }] },
  content: { paddingHorizontal: 18, paddingBottom: 24, gap: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 22px rgba(29,70,48,0.22)',
  },
  heroText: { flex: 1, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 24, lineHeight: 31 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,236,214,0.95)',
  },
  chipText: { color: '#8F4520', fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
  segmented: { flexDirection: 'row', borderRadius: 18, padding: 4 },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
    boxShadow: '0 4px 10px rgba(29,70,48,0.08)',
  },
  underline: { width: '62%', height: 3, borderRadius: 2, marginBottom: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  segmentLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  section: { gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 16 },
  ratio: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDate: { flex: 1, fontFamily: 'Manrope_500Medium' },
  // WARNING: На Android с этим шрифтом строка «по размеру текста» измеряется на 1–2 % уже, чем
  // рисуется, и последнее слово обрезается. Поэтому подписям в рядах даётся место (flex).
  dayStatus: { flex: 1, textAlign: 'right' },
  grow: { flex: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 8 },
});
