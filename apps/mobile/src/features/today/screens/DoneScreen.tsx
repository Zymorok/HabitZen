import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { planProgress, usePlanCommand, useTodayPlan } from '../data/usePlan';
import { resetTo } from '../../../navigation/reset-to';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
import leafGreen from '../../../../assets/onboarding/leaf_green.webp';
import leafOrange from '../../../../assets/onboarding/leaf_orange.webp';
import grass from '../../../../assets/onboarding/grass_2.webp';

/**
 * Кадр 05: подтверждённая отметка. Галочка «выпрыгивает», сверху падают листья,
 * карточка показывает новый прогресс дня. Отметку можно отменить.
 */
export function DoneScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['habits', 'errors', 'common']);
  const { theme, night, isDark } = useAppPreferences();
  const plan = useTodayPlan();
  const command = usePlanCommand();
  const item = plan.data?.find((entry) => entry.itemId === itemId);
  const progress = planProgress(plan.data ?? []);
  const pop = useSharedValue(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    // NOTE: 0 → 1,15 → 1: как в спецификации движения (successScale).
    pop.value = withSequence(
      withSpring(motion.successScale.from, { damping: 9, stiffness: 160 }),
      withSpring(motion.successScale.to, motion.spring),
    );
  }, [pop]);
  useEffect(() => {
    fill.value = withDelay(
      350,
      withTiming(progress.total ? progress.completed / progress.total : 0, { duration: 700 }),
    );
  }, [progress.completed, progress.total, fill]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.value, [0, 1], ['#FCF7EA', darkTheme.background]),
  }));
  const goToday = () => resetTo(router, '/today');

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="done-screen">
      <Confetti />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 24) + 30 }]}>
        <Animated.View style={[styles.checkCircle, popStyle]}>
          <Icon name="check" size={64} color="#FFFDF3" strokeWidth={2.6} />
        </Animated.View>
        <ThemedText variant="title" style={styles.title} testID="done-title">
          {progress.allDone ? t('habits:day_complete') : t('habits:excellent')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{item?.title ?? t('habits:completed')}</ThemedText>
      </View>

      <View style={styles.landscape} pointerEvents="none">
        <Image source={isDark ? hillsNight : hillsDay} style={styles.hills} resizeMode="cover" />
        <Image source={grass} style={[styles.grass, { left: '6%' }]} resizeMode="contain" />
        <Image
          source={grass}
          style={[styles.grass, { right: '8%', transform: [{ scaleX: -1 }] }]}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Animated.View
          entering={FadeInDown.delay(220).duration(420)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          testID="done-progress"
        >
          <View style={styles.cardRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="small" style={{ color: theme.textMuted }}>
                {t('common:today')}
              </AppText>
              <AppText style={styles.cardValue}>
                {t('habits:daily_progress', {
                  completed: progress.completed,
                  total: progress.total,
                })}
              </AppText>
            </View>
            <Icon name="leaf" size={26} color={theme.success} />
          </View>
          <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
            <Animated.View style={[styles.bar, { backgroundColor: theme.success }, barStyle]} />
          </View>
        </Animated.View>
        <Button label={t('common:continue')} onPress={goToday} testID="done-continue" />
        {item?.status === 'completed' ? (
          <Button
            label={t('habits:undo')}
            variant="quiet"
            onPress={() =>
              command.mutate(
                { command: 'undo', item, requestId: newRequestId() },
                { onSuccess: goToday },
              )
            }
            testID="done-undo"
          />
        ) : null}
        {command.isError ? (
          <AppText variant="small" style={{ color: theme.error, textAlign: 'center' }}>
            {t(errorMessageKey(command.error))}
          </AppText>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Листья падают сверху и кружатся — праздник без лишнего шума. */
function Confetti() {
  const { animate } = useMotionPolicy();
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        left: `${((index * 37) % 92) + 4}%` as const,
        delay: (index * 173) % 1400,
        size: 12 + ((index * 7) % 10),
        source: index % 3 === 0 ? leafGreen : leafOrange,
        drift: index % 2 ? 18 : -18,
      })),
    [],
  );
  if (!animate) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, index) => (
        <FallingLeaf key={index} {...piece} />
      ))}
    </View>
  );
}

function FallingLeaf({
  left,
  delay,
  size,
  source,
  drift,
}: {
  readonly left: `${number}%`;
  readonly delay: number;
  readonly size: number;
  readonly source: ImageSourcePropType;
  readonly drift: number;
}) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false),
    );
  }, [delay, fall]);
  const style = useAnimatedStyle(() => ({
    opacity: fall.value < 0.05 ? fall.value * 20 : 1 - Math.max(0, fall.value - 0.75) * 4,
    transform: [
      { translateY: -40 + fall.value * 520 },
      { translateX: Math.sin(fall.value * Math.PI * 4) * drift },
      { rotate: `${fall.value * 540}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left, top: 0, width: size, height: size }, style]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  top: { alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  // NOTE: Один насыщенный зелёный для обеих тем: белая галочка читается и днём, и ночью.
  checkCircle: {
    backgroundColor: '#3E7D50',
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 30px rgba(59,128,86,0.35)',
    marginBottom: 10,
  },
  title: { fontSize: 30, lineHeight: 38, textAlign: 'center' },
  subtitle: { fontSize: 17, textAlign: 'center' },
  landscape: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden', minHeight: 120 },
  // WARNING: Размеры заданы явно: на Android картинка без ширины не растягивается.
  hills: { position: 'absolute', left: '-20%', width: '140%', bottom: -40, height: 240 },
  grass: { position: 'absolute', bottom: 0, width: 90, height: 80 },
  bottom: { paddingHorizontal: 22, gap: 12, marginTop: -40 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    boxShadow: '0 10px 26px rgba(18,47,32,0.08)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardValue: { fontFamily: 'Manrope_600SemiBold', fontSize: 16 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
});
