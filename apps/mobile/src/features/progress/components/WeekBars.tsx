import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';

export interface Bar {
  readonly key: string;
  /** Высота 0…1; null — день без запланированного (низкий светлый столбик). */
  readonly value: number | null;
  readonly future: boolean;
  /** Выделенный день (сегодня или выбранный в календаре) — темнее остальных. */
  readonly strong?: boolean;
  readonly label: string;
}

/**
 * Столбики недели (кадры 08 и 09). Высота вырастает пружиной при смене недели или данных.
 * NOTE: Будущие дни — бледные заготовки, чтобы неделя читалась целиком.
 */
export function WeekBars({
  bars,
  height = 74,
  testID,
}: {
  readonly bars: readonly Bar[];
  readonly height?: number;
  readonly testID?: string;
}) {
  const { theme } = useAppPreferences();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.row, { height }]}>
        {bars.map((bar) => (
          <BarColumn key={bar.key} bar={bar} height={height} />
        ))}
      </View>
      <View style={[styles.labels, { borderTopColor: theme.border }]}>
        {bars.map((bar) => (
          <AppText
            key={bar.key}
            style={[
              styles.label,
              { color: bar.strong ? theme.text : theme.textMuted },
              bar.strong ? styles.labelStrong : null,
            ]}
          >
            {bar.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function BarColumn({ bar, height }: { readonly bar: Bar; readonly height: number }) {
  const { isDark } = useAppPreferences();
  const target = bar.future ? 0.2 : bar.value === null ? 0.1 : Math.max(0.14, bar.value);
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withSpring(target, { damping: 14, stiffness: 120 });
  }, [target, grow]);
  const style = useAnimatedStyle(() => ({ height: grow.value * height }));
  const colors: readonly [string, string] = bar.future
    ? isDark
      ? ['#2A4335', '#22382C']
      : ['#E9F0E1', '#DCE7D3']
    : bar.strong
      ? ['#3E7D50', '#2D6249']
      : bar.value !== null && bar.value >= 1
        ? ['#5C9A68', '#3E7D50']
        : isDark
          ? ['#5E9466', '#42704F']
          : ['#9CC596', '#7EAF7B'];
  return (
    <View style={styles.column}>
      <Animated.View style={[styles.bar, style]}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 30, borderRadius: 7, overflow: 'hidden' },
  labels: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  labelStrong: { fontFamily: 'Manrope_700Bold' },
});
