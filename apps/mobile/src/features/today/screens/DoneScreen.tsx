import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
import { LeafConfetti } from '../../../shared/motion/LeafConfetti';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { useGarden } from '../../garden/data/useGarden';
import { planProgress, usePlanCommand, useTodayPlan } from '../data/usePlan';
import { resetTo } from '../../../navigation/reset-to';
import { StackTabBar } from '../../../navigation/TabBar';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
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
  const garden = useGarden();
  const goToday = () => resetTo(router, '/today');
  // NOTE: Последняя привычка дня ведёт к награде (кадр 11), но только если её ещё не было сегодня.
  const goNext = () => {
    if (progress.allDone && garden.data && !garden.data.rewardToday) router.replace('/celebration');
    else goToday();
  };

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="done-screen">
      <LeafConfetti />
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

      <View style={[styles.bottom, { paddingBottom: 14 }]}>
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
        <Button label={t('common:continue')} onPress={goNext} testID="done-continue" />
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
      {/* NOTE: Нижнее меню, как на кадре 05 макета. */}
      <StackTabBar active="today" />
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
