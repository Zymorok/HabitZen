import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { LocalDate } from '@habitzen/core/calendar';
import { formatShortMonth } from '@habitzen/i18n/formatters';
import type { SupportedLocale } from '@habitzen/i18n/locales';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import type { YearCell } from '../stats';
import { frozenShade, shadeOf } from './MonthGrid';

const GAP = 2;
const LABEL = 14;

/**
 * Годовая карта (HZ-08): 53 недели квадратиками, чем гуще зелень — тем больше сделано.
 * NOTE: Одна картинка SVG вместо 371 отдельного элемента — экран прогресса не тяжелеет.
 */
export const YearMap = memo(function YearMap({
  columns,
  months,
  frozen,
  width,
}: {
  readonly columns: readonly (readonly YearCell[])[];
  readonly months: readonly { readonly column: number; readonly month: LocalDate }[];
  readonly frozen: ReadonlySet<string>;
  readonly width: number;
}) {
  const { t, i18n } = useTranslation('progress');
  const { theme, isDark, palette } = useAppPreferences();
  const locale = i18n.language as SupportedLocale;
  const cell = Math.max(3, (width - GAP * (columns.length - 1)) / columns.length);
  const height = LABEL + cell * 7 + GAP * 6;
  const empty = isDark ? '#1E3229' : '#ECEEE4';
  const colorOf = (item: YearCell) =>
    frozen.has(item.date)
      ? frozenShade(isDark).bg
      : item.intensity === null
        ? empty
        : shadeOf(item.intensity, isDark, palette.shades).bg;
  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        {months.map(({ column, month }) => (
          <SvgText
            key={month}
            x={column * (cell + GAP)}
            y={10}
            fontSize={10}
            fill={theme.textMuted}
          >
            {formatShortMonth(month, locale)}
          </SvgText>
        ))}
        {columns.map((week, column) =>
          week.map((item, row) => (
            <Rect
              key={item.date}
              x={column * (cell + GAP)}
              y={LABEL + row * (cell + GAP)}
              width={cell}
              height={cell}
              rx={Math.min(2, cell / 3)}
              fill={colorOf(item)}
            />
          )),
        )}
      </Svg>
      <View style={styles.legend}>
        <AppText variant="small" style={{ color: theme.textMuted }}>
          {t('year_less')}
        </AppText>
        {[0, 1, 2, 3, 4].map((level) => (
          <View
            key={level}
            style={[styles.swatch, { backgroundColor: shadeOf(level, isDark, palette.shades).bg }]}
          />
        ))}
        <AppText variant="small" style={{ color: theme.textMuted }}>
          {t('year_more')}
        </AppText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
