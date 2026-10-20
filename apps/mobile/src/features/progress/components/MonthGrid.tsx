import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { isoWeekday, monthDays } from '@habitzen/core/calendar';
import type { LocalDate } from '@habitzen/core/calendar';
import { formatCalendarDate } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useTranslation } from 'react-i18next';
import { palettes } from '@habitzen/design/tokens';
import type { Palette } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import type { CalendarDay } from '../data/progress-api';
import { dayIntensity, dayShare } from '../stats';

// NOTE: Пропуск, закрытый заморозкой серии (HZ-08), — ледяной голубой кружок.
const FROZEN = {
  day: { bg: '#DCEBF5', text: '#2F5B78' },
  night: { bg: '#2B4152', text: '#CFE3F2' },
} as const;

// NOTE: Чем больше сделано за день, тем гуще цвет кружка (HZ-R08); оттенки — из темы (HZ-08).

/** Цвет дня, который закрыла заморозка серии (тот же в месяце и на годовой карте). */
export function frozenShade(isDark: boolean): { bg: string; text: string } {
  return FROZEN[isDark ? 'night' : 'day'];
}

export function shadeOf(
  intensity: number,
  isDark: boolean,
  shades: Palette['shades'] = palettes.forest.shades,
): { bg: string; text: string } {
  const bg = shades[isDark ? 'night' : 'day'][intensity] ?? shades.day[0] ?? '#E7EDDD';
  const strong = intensity === 4;
  return { bg, text: strong ? (isDark ? '#14231E' : '#FFFDF3') : isDark ? '#F6F3E8' : '#172B22' };
}

/**
 * Сетка месяца кадра 08: дни недели с понедельника, кружки по насыщенности выполнения,
 * сегодняшний день крупнее и обведён. Нажатие выбирает день для карточки и недели ниже.
 */
export const MonthGrid = memo(function MonthGrid({
  month,
  direction,
  days,
  today,
  selected,
  width,
  weekdays,
  onSelect,
  frozen,
}: {
  readonly month: LocalDate;
  /** Куда перелистнули: новый месяц въезжает с той же стороны. */
  readonly direction: -1 | 0 | 1;
  readonly days: ReadonlyMap<string, CalendarDay>;
  readonly today: LocalDate;
  readonly selected: LocalDate;
  readonly width: number;
  readonly weekdays: readonly string[];
  readonly onSelect: (date: LocalDate) => void;
  /** Дни, которые закрыла заморозка серии. */
  readonly frozen: ReadonlySet<string>;
}) {
  const { theme } = useAppPreferences();
  const cell = width / 7;
  const circle = Math.min(42, Math.floor(cell - 8));
  const dates = monthDays(month);
  const leading = isoWeekday(dates[0]!);
  const entering =
    direction === 0 ? undefined : (direction > 0 ? FadeInRight : FadeInLeft).duration(320);
  return (
    <View>
      <View style={styles.row}>
        {weekdays.map((label) => (
          <AppText
            key={label}
            maxFontSizeMultiplier={1.2}
            style={[styles.weekday, { width: cell, color: theme.textMuted }]}
            numberOfLines={1}
          >
            {label}
          </AppText>
        ))}
      </View>
      <Animated.View
        key={month}
        {...(entering ? { entering } : {})}
        style={styles.grid}
        testID="month-grid"
      >
        {Array.from({ length: leading }, (_, index) => (
          <View key={`gap-${index}`} style={{ width: cell, height: circle + 14 }} />
        ))}
        {dates.map((date) => (
          <DayCell
            key={date}
            date={date}
            day={days.get(date)}
            today={today}
            selected={selected === date}
            frozen={frozen.has(date)}
            cell={cell}
            circle={circle}
            onSelect={onSelect}
          />
        ))}
      </Animated.View>
    </View>
  );
});

function DayCell({
  date,
  day,
  today,
  selected,
  frozen,
  cell,
  circle,
  onSelect,
}: {
  readonly date: LocalDate;
  readonly day: CalendarDay | undefined;
  readonly today: LocalDate;
  readonly selected: boolean;
  readonly frozen: boolean;
  readonly cell: number;
  readonly circle: number;
  readonly onSelect: (date: LocalDate) => void;
}) {
  const { t, i18n } = useTranslation('progress');
  const { theme, isDark, palette } = useAppPreferences();
  const isToday = date === today;
  const future = date > today;
  const share = dayShare(day);
  const intensity = future ? 0 : dayIntensity(share);
  const shade = frozen ? frozenShade(isDark) : shadeOf(intensity, isDark, palette.shades);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!selected) return;
    pop.value = withSequence(
      withTiming(0.86, { duration: 90 }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    );
  }, [selected, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const size = isToday ? circle + 6 : circle;
  const label = formatCalendarDate(date, i18n.language as SupportedLocale);
  const status = future
    ? t('day_future')
    : !day
      ? t('day_empty')
      : share === null
        ? t('day_rest')
        : t('day_progress', { completed: day.completed, total: day.planned - day.skipped }) +
          (frozen ? `. ${t('day_frozen')}` : '');
  return (
    <Pressable
      onPress={() => onSelect(date)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${status}`}
      accessibilityState={{ selected }}
      testID={`day-${date}`}
      style={[styles.cell, { width: cell, height: circle + 14 }]}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: future || !day ? (isDark ? '#1E3229' : '#F1F2EA') : shade.bg,
          },
          intensity > 0 ? styles.raised : null,
          isToday ? [styles.today, { borderColor: theme.primary }] : null,
          selected && !isToday ? { borderWidth: 2, borderColor: theme.primarySoft } : null,
          popStyle,
        ]}
      >
        <AppText
          maxFontSizeMultiplier={1.25}
          style={[
            styles.number,
            { color: future || !day ? theme.textMuted : shade.text },
            isToday ? styles.todayNumber : null,
          ]}
        >
          {Number(date.slice(8))}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    textAlign: 'center',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  raised: { boxShadow: '0 3px 8px rgba(29,70,48,0.16)' },
  today: { borderWidth: 2.5, boxShadow: '0 6px 14px rgba(29,70,48,0.32)' },
  number: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, lineHeight: 18 },
  todayNumber: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
});
