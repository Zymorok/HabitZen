import { useEffect, useRef } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { resetTo } from '../../../navigation/reset-to';
import { useHaptics } from '../../../shared/haptics';
import { LeafConfetti } from '../../../shared/motion/LeafConfetti';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { newRequestId } from '../../habits/data/habits-api';
import { planProgress, useStreak, useTodayPlan } from '../../today/data/usePlan';
import { flameColor } from '../../today/streak-look';
import { useClaimDayReward, useGarden } from '../data/useGarden';
import { TREE_ASPECT, treeArt } from '../tree-art';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
import rocks from '../../../../assets/onboarding/hill_rocks.webp';

const RAYS = 14;

/**
 * Кадр 11: «Все N привычек выполнены!» — однократная награда за полный день.
 * NOTE: Награда записывается на сервере при показе экрана, поэтому повторно за этот день
 * экран не появится, даже если отменить и снова отметить привычку.
 */
export function CelebrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation(['progress', 'common']);
  const { isDark } = useAppPreferences();
  const { animate } = useMotionPolicy();
  const haptics = useHaptics();
  const plan = useTodayPlan();
  const streak = useStreak();
  const garden = useGarden();
  const claim = useClaimDayReward();
  const requestId = useRef(newRequestId());
  const claimed = useRef(false);
  const progress = planProgress(plan.data ?? []);
  const level = garden.data?.level ?? 1;

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    claim.mutate(requestId.current);
    haptics.success();
  }, [claim, haptics]);

  const pop = useSharedValue(0.6);
  const spin = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(150, withSpring(1, { damping: 8, stiffness: 110 }));
    if (animate)
      spin.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false);
  }, [pop, spin, animate]);
  const treeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, (pop.value - 0.6) * 2.5) * 0.9,
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const sceneHeight = Math.min(height * 0.5, 440);
  const treeHeight = sceneHeight * 0.86;
  const raysSize = Math.max(width, sceneHeight) * 1.5;
  const current = streak.data?.current ?? 0;

  return (
    <View style={styles.shell} testID="celebration-screen">
      <LinearGradient
        colors={isDark ? ['#1A2A22', '#2E3326', '#1A2A22'] : ['#FDF8EC', '#FBEBD0', '#F6F1DF']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rays,
          {
            width: raysSize,
            height: raysSize,
            left: (width - raysSize) / 2,
            top: height * 0.52 - raysSize / 2,
          },
          raysStyle,
        ]}
      >
        <Svg width={raysSize} height={raysSize} viewBox="-100 -100 200 200">
          {Array.from({ length: RAYS }, (_, index) => {
            const angle = (index / RAYS) * Math.PI * 2;
            const spread = Math.PI / RAYS / 2.2;
            const x1 = Math.cos(angle - spread) * 100;
            const y1 = Math.sin(angle - spread) * 100;
            const x2 = Math.cos(angle + spread) * 100;
            const y2 = Math.sin(angle + spread) * 100;
            return (
              <Path
                key={index}
                d={`M0 0 L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
                fill={isDark ? '#F6D58E' : '#FFFFFF'}
                opacity={isDark ? 0.08 : 0.55}
              />
            );
          })}
        </Svg>
      </Animated.View>
      <LeafConfetti count={18} distance={height} />

      <View style={[styles.top, { paddingTop: Math.max(insets.top, 20) + 28 }]}>
        <ThemedText variant="title" style={styles.title} testID="celebration-title">
          {t('progress:celebration_title', { count: progress.completed })}
        </ThemedText>
        {current > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={styles.chip}
            testID="celebration-streak"
          >
            <Icon name="flame" size={18} color={flameColor(current)} strokeWidth={2} />
            <AppText style={styles.chipText}>
              {t('progress:streak_days', { count: current })}
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.scene, { height: sceneHeight }]} pointerEvents="none">
        <Image
          source={isDark ? hillsNight : hillsDay}
          style={[styles.hills, { width: width * 1.4, height: width * 0.93, left: -width * 0.2 }]}
          resizeMode="cover"
        />
        <Animated.View style={[styles.treeWrap, treeStyle]}>
          <Image
            source={treeArt(level)}
            style={{
              width: treeHeight * TREE_ASPECT,
              height: treeHeight,
              marginBottom: -sceneHeight * 0.06,
            }}
            resizeMode="contain"
            accessible
            accessibilityLabel={t('progress:tree_a11y', { level })}
          />
          <Image
            source={rocks}
            style={{
              width: Math.min(width * 0.78, 340),
              height: Math.min(width * 0.78, 340) * 0.41,
            }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Button
          label={t('progress:celebration_ok')}
          onPress={() => resetTo(router, '/today')}
          testID="celebration-ok"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, overflow: 'hidden' },
  rays: { position: 'absolute' },
  top: { alignItems: 'center', gap: 14, paddingHorizontal: 28 },
  title: { fontSize: 30, lineHeight: 39, textAlign: 'center', alignSelf: 'stretch' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(255,236,214,0.95)',
    boxShadow: '0 6px 16px rgba(229,121,62,0.16)',
    width: 200,
  },
  chipText: { flex: 1, color: '#8F4520', fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  scene: { marginTop: 'auto', justifyContent: 'flex-end', alignItems: 'center' },
  hills: { position: 'absolute', bottom: -60 },
  treeWrap: { alignItems: 'center', justifyContent: 'flex-end', transformOrigin: '50% 100%' },
  bottom: { paddingHorizontal: 22, paddingTop: 14 },
});
