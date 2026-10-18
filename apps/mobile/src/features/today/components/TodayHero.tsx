import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { Icon } from '../../../shared/ui/Icon';
import { AppText } from '../../../shared/ui/AppText';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
import sapling from '../../../../assets/onboarding/sapling.webp';
import tree from '../../../../assets/onboarding/tree.webp';

/**
 * Верх кадра 02: небо, холмы, дерево на холмике и серия «N дней подряд».
 * NOTE: Дерево тихо покачивается и подрастает, когда серия становится длиннее.
 * TODO(HZ-06): Стадии дерева по уровням из выполненных дел (5 × N × (N−1)).
 */
export function TodayHero({
  streak,
  height,
}: {
  readonly streak: number;
  readonly height: number;
}) {
  const { t } = useTranslation('progress');
  const { isDark, night } = useAppPreferences();
  const { animate } = useMotionPolicy();
  const sway = useSharedValue(0);
  const grow = useSharedValue(0);
  const grown = streak >= 3;

  useEffect(() => {
    if (!animate) return;
    sway.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [animate, sway]);
  useEffect(() => {
    grow.value = 0;
    grow.value = withSpring(1, { damping: 12, stiffness: 90 });
  }, [grown, grow]);

  const treeStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(sway.value, [0, 1], [-1.4, 1.4])}deg` },
      { scale: interpolate(grow.value, [0, 1], [0.85, 1]) },
    ],
  }));
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value }));
  const treeHeight = height * (grown ? 0.82 : 0.66);
  // WARNING: Размеры холмов в пикселях: проценты с aspectRatio в вебе дают картинку нулевой высоты.
  const { width: windowWidth } = useWindowDimensions();
  const hillsWidth = Math.min(windowWidth, 480) * 1.2;
  const hillsSize = { width: hillsWidth, height: hillsWidth / 1.5, bottom: -hillsWidth * 0.1 };
  const dimStyle = useAnimatedStyle(() => ({ opacity: night.value * 0.45 }));
  return (
    <View style={[styles.hero, { height }]} pointerEvents="box-none">
      <LinearGradient
        colors={isDark ? ['#14231E', '#1D3A3F'] : ['#FBF8EF', '#EEF2DF']}
        style={StyleSheet.absoluteFill}
      />
      <Image source={hillsDay} style={[styles.hills, hillsSize]} resizeMode="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, nightStyle]} pointerEvents="none">
        <Image source={hillsNight} style={[styles.hills, hillsSize]} resizeMode="cover" />
      </Animated.View>
      <View style={[styles.treeSpot, { height: treeHeight + 26 }]} pointerEvents="none">
        <Svg width={190} height={36} style={styles.mound}>
          <Defs>
            <RadialGradient id="todayMound" cx="50%" cy="40%" r="60%">
              <Stop offset="0" stopColor={isDark ? '#3E6248' : '#9CC07A'} />
              <Stop offset="1" stopColor={isDark ? '#2A4636' : '#78A35E'} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={95} cy={22} rx={92} ry={14} fill="url(#todayMound)" />
        </Svg>
        <Animated.View style={[styles.tree, { height: treeHeight, width: treeHeight }, treeStyle]}>
          <Image source={grown ? tree : sapling} style={styles.fill} resizeMode="contain" />
          {/* NOTE: Ночью дерево темнеет тем же силуэтом — как предметы в мире первого запуска. */}
          <Animated.Image
            source={grown ? tree : sapling}
            style={[styles.fill, styles.dim, dimStyle]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
      {streak > 0 ? (
        <View style={styles.streak} testID="today-streak">
          <Icon name="flame" size={18} color="#E5793E" strokeWidth={2} />
          <AppText style={styles.streakText}>{t('streak_days', { count: streak })}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  // WARNING: Размер картинки задаётся явно: на Android left/right без width не растягивают Image.
  // NOTE: Картинка целиком по ширине: холмы занимают нижнюю половину рисунка и встают за деревом.
  hills: { position: 'absolute', left: '-10%' },
  treeSpot: {
    position: 'absolute',
    left: '14%',
    bottom: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mound: { position: 'absolute', bottom: -6 },
  tree: { transformOrigin: '50% 100%' },
  fill: { width: '100%', height: '100%' },
  dim: { position: 'absolute', left: 0, top: 0, tintColor: '#0A1824' },
  streak: {
    position: 'absolute',
    right: 18,
    top: '38%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,236,214,0.94)',
    boxShadow: '0 6px 16px rgba(229,121,62,0.16)',
  },
  streakText: {
    color: '#A65327',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    maxWidth: 92,
    lineHeight: 17,
  },
});
