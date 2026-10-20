import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ACCENTS, palettes } from '@habitzen/design/tokens';
import type { AccentKey } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useHaptics } from '../../../shared/haptics';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';

/**
 * Цветовая тема (HZ-08): четыре кружка — «Лес», «Закат», «Океан», «Лаванда».
 * Выбор сразу перекрашивает приложение и хранится на устройстве, как светлая и тёмная тема.
 */
export function AccentPicker() {
  const { t } = useTranslation('settings');
  const { preferences, setAccent } = useAppPreferences();
  const haptics = useHaptics();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {ACCENTS.map((key) => (
        <Swatch
          key={key}
          accent={key}
          label={t(`accent_${key}`)}
          selected={preferences.accent === key}
          onPress={() => {
            haptics.selection();
            setAccent(key);
          }}
        />
      ))}
    </View>
  );
}

function Swatch({
  accent,
  label,
  selected,
  onPress,
}: {
  readonly accent: AccentKey;
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { theme, isDark } = useAppPreferences();
  const colors = palettes[accent][isDark ? 'dark' : 'light'];
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    pop.value = withSpring(selected ? 1 : 0, motion.pressSpring);
  }, [selected, pop]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + pop.value * 0.1 }],
    borderColor: selected ? colors.primary : 'transparent',
  }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      testID={`accent-${accent}`}
      style={styles.item}
    >
      <Animated.View style={[styles.ring, ringStyle]}>
        {/* NOTE: Половина — основной цвет темы, половина — её мягкий оттенок. */}
        <View style={[styles.circle, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.half, { backgroundColor: colors.primary }]} />
          {selected ? (
            <View style={styles.check}>
              <Icon name="check" size={18} color={colors.background} strokeWidth={2.8} />
            </View>
          ) : null}
        </View>
      </Animated.View>
      <AppText
        style={[styles.label, { color: selected ? theme.text : theme.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  half: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 23 },
  check: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // WARNING: Подпись во всю ширину ячейки — на Android короткий текст иначе обрезается.
  label: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
});
