import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { habitArt } from '../../../shared/habit-art';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';

/**
 * Привычка, в которую засчитается фокус: «Читать 20 минут ▾». Пока занятие идёт,
 * привычку не поменять — стрелка пропадает.
 * NOTE: Пилюля полупрозрачная, чтобы не спорить с пейзажем кадра 06.
 */
export function HabitChip({
  title,
  iconKey,
  locked,
  onPress,
}: {
  readonly title: string | null;
  readonly iconKey: string | null;
  readonly locked: boolean;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation('focus');
  const { theme, isDark } = useAppPreferences();
  const label = title ?? t('habit_none');
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={t('habit_label', { title: label })}
        accessibilityState={{ disabled: locked }}
        testID="focus-habit"
        style={[
          styles.chip,
          {
            backgroundColor: isDark ? 'rgba(29,50,41,0.78)' : 'rgba(255,253,245,0.86)',
            borderColor: theme.border,
          },
        ]}
      >
        {iconKey ? (
          <Image
            source={habitArt(iconKey)}
            style={styles.art}
            resizeMode="contain"
            accessible={false}
          />
        ) : (
          <Icon name="leaf" size={16} color={theme.textMuted} />
        )}
        <AppText numberOfLines={1} style={[styles.text, { color: theme.text }]}>
          {label}
        </AppText>
        {locked ? null : (
          <View style={styles.down}>
            <Icon name="arrow" size={15} color={theme.textMuted} strokeWidth={2} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 280,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  art: { width: 20, height: 20 },
  down: { transform: [{ rotate: '90deg' }] },
  text: { flexShrink: 1, fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
});
