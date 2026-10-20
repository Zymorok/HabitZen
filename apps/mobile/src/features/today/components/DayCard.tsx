import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { addCalendarDays, localDate, startOfIsoWeek } from '@habitzen/core/calendar';
import { weekdayLabels } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { useCalendarDays } from '../../progress/data/useProgress';
import { dayShare } from '../../progress/stats';
import { dayMotto } from '../motto';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 64;
const RING_STROKE = 7;
const RING_RADIUS = (RING - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const DOT = 26;
const DOT_STROKE = 3;
const DOT_RADIUS = (DOT - DOT_STROKE) / 2;
const DOT_LENGTH = 2 * Math.PI * DOT_RADIUS;

/**
 * Карточка дня на главном экране (HZ-10): кольцо с процентом, «1 из 3 привычек», подсказка,
 * сколько осталось, и лента недели — кружок на каждый день, заполненный по доле выполненного.
 * NOTE: Сегодняшний кружок берётся из живого плана, а не из календаря — он меняется сразу.
 */
export function DayCard({
  completed,
  total,
  allDone,
  date,
  onWeekPress,
}: {
  readonly completed: number;
  readonly total: number;
  readonly allDone: boolean;
  readonly date: string;
  readonly onWeekPress: () => void;
}) {
  const { t, i18n } = useTranslation('habits');
  const { theme } = useAppPreferences();
  const share = total > 0 ? completed / total : 0;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(share, { duration: 650 });
  }, [share, fill]);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - fill.value),
  }));
  const motto = dayMotto(completed, total);

  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="today-progress"
    >
      <View style={styles.top}>
        <View style={styles.ring}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
              fill="none"
              stroke={theme.surfaceMuted}
            />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
              fill="none"
              stroke={theme.success}
              strokeLinecap="round"
              strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          {allDone ? (
            <Icon name="check" size={24} color={theme.success} strokeWidth={2.6} />
          ) : (
            <AppText style={styles.percent} testID="today-percent">
              {total > 0 ? `${Math.round(share * 100)}%` : '—'}
            </AppText>
          )}
        </View>
        <View style={styles.texts}>
          <AppText style={styles.progressText}>
            {total > 0 ? t('daily_progress', { completed, total }) : t('daily_optional')}
          </AppText>
          <AppText
            variant="small"
            style={{ color: allDone ? theme.success : theme.textMuted }}
            testID={allDone ? 'today-all-done' : 'today-motto'}
          >
            {motto.options ? t(motto.key, motto.options) : t(motto.key)}
          </AppText>
        </View>
      </View>
      <WeekStrip
        date={date}
        todayShare={total > 0 ? share : null}
        locale={i18n.language as SupportedLocale}
        onPress={onWeekPress}
      />
    </Animated.View>
  );
}

/** Семь кружков недели: прошедшие — по календарю, сегодняшний — по живому плану. */
function WeekStrip({
  date,
  todayShare,
  locale,
  onPress,
}: {
  readonly date: string;
  readonly todayShare: number | null;
  readonly locale: SupportedLocale;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation('progress');
  const { theme } = useAppPreferences();
  const today = localDate(date);
  const weekStart = startOfIsoWeek(today);
  const calendar = useCalendarDays(weekStart, addCalendarDays(weekStart, 6));
  const labels = useMemo(() => weekdayLabels(locale), [locale]);
  const byDate = new Map((calendar.data ?? []).map((day) => [day.date, day]));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('week_activity')}
      style={[styles.week, { borderTopColor: theme.border }]}
      testID="today-week"
    >
      {labels.map((label, index) => {
        const day = addCalendarDays(weekStart, index);
        const isToday = day === today;
        const future = day > today;
        const share = isToday ? todayShare : future ? null : dayShare(byDate.get(day));
        return (
          <View key={day} style={styles.weekDay} testID={`today-week-${day}`}>
            <AppText
              style={[
                styles.weekLabel,
                { color: isToday ? theme.text : theme.textMuted },
                isToday ? styles.weekLabelToday : null,
              ]}
              maxFontSizeMultiplier={1.2}
            >
              {label}
            </AppText>
            <DayDot share={share} future={future} today={isToday} />
          </View>
        );
      })}
    </Pressable>
  );
}

function DayDot({
  share,
  future,
  today,
}: {
  readonly share: number | null;
  readonly future: boolean;
  readonly today: boolean;
}) {
  const { theme } = useAppPreferences();
  const full = share !== null && share >= 1;
  return (
    <View style={[styles.dotOuter, today ? { borderColor: theme.primary } : null]}>
      <View style={styles.dot}>
        <Svg width={DOT} height={DOT} style={StyleSheet.absoluteFill}>
          <Circle
            cx={DOT / 2}
            cy={DOT / 2}
            r={DOT_RADIUS}
            strokeWidth={DOT_STROKE}
            fill={full ? theme.success : 'none'}
            stroke={future ? theme.surfaceMuted : full ? theme.success : theme.border}
          />
          {share !== null && share > 0 && !full ? (
            <Circle
              cx={DOT / 2}
              cy={DOT / 2}
              r={DOT_RADIUS}
              strokeWidth={DOT_STROKE}
              fill="none"
              stroke={theme.success}
              strokeLinecap="round"
              strokeDasharray={`${DOT_LENGTH * share} ${DOT_LENGTH}`}
              transform={`rotate(-90 ${DOT / 2} ${DOT / 2})`}
            />
          ) : null}
        </Svg>
        {full ? <Icon name="check" size={13} color={theme.background} strokeWidth={3} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    boxShadow: '0 10px 26px rgba(18,47,32,0.08)',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: 'Manrope_700Bold', fontSize: 15, lineHeight: 20 },
  texts: { flex: 1, gap: 3 },
  progressText: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, alignSelf: 'stretch' },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  weekDay: { flex: 1, alignItems: 'center', gap: 4 },
  weekLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.3,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  weekLabelToday: { fontFamily: 'Manrope_700Bold' },
  // NOTE: Сегодняшний день обведён тонким кольцом цвета темы.
  dotOuter: {
    width: DOT + 6,
    height: DOT + 6,
    borderRadius: (DOT + 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    borderWidth: 1.5,
  },
  dot: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
});
