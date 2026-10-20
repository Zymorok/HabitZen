import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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
import { flameColor } from '../streak-look';
import { stageIndex } from '../../garden/stage';
import { TREE_ASPECT, treeArt } from '../../garden/tree-art';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';

/**
 * Верх кадра 02: небо, холмы, дерево на холмике и серия «N дней подряд».
 * NOTE: Дерево растёт по уровням из выполненных дел (HZ-06) и тихо покачивается.
 * Нажатие на дерево открывает «Твоё дерево» (кадр 10).
 */
export function TodayHero({
  streak,
  level,
  height,
  onTreePress,
}: {
  readonly streak: number;
  readonly level: number;
  readonly height: number;
  readonly onTreePress: () => void;
}) {
  const { t } = useTranslation('progress');
  const { isDark, night } = useAppPreferences();
  const { animate } = useMotionPolicy();
  const sway = useSharedValue(0);
  const grow = useSharedValue(0);
  const stage = stageIndex(level);

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
  }, [stage, grow]);

  const treeStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(sway.value, [0, 1], [-1.4, 1.4])}deg` },
      { scale: interpolate(grow.value, [0, 1], [0.85, 1]) },
    ],
  }));
  // NOTE: Серия выросла — огонёк делает двойной пружинный прыжок и разгорается из серого
  // в оранжевый (HZ-R12). При «Меньше движения» остаётся только плавная смена цвета.
  const jump = useSharedValue(0);
  const warm = useSharedValue(1);
  const previousStreak = useRef(streak);
  useEffect(() => {
    const grew = streak > previousStreak.current;
    previousStreak.current = streak;
    if (!grew) return;
    warm.value = 0;
    warm.value = withTiming(1, { duration: animate ? 900 : 400 });
    if (!animate) return;
    jump.value = withSequence(
      withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 12, stiffness: 260 }),
      withTiming(0.55, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 9, stiffness: 220 }),
    );
  }, [streak, animate, jump, warm]);
  const coldStyle = useAnimatedStyle(() => ({ opacity: 1 - warm.value }));
  const warmStyle = useAnimatedStyle(() => ({ opacity: warm.value }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -jump.value * 12 },
      { scale: 1 + jump.value * 0.35 },
      { rotate: `${jump.value * -10}deg` },
    ],
  }));
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value }));
  const treeHeight = height * 0.86;
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
      <Pressable
        onPress={onTreePress}
        accessibilityRole="button"
        accessibilityLabel={t('tree_a11y', { level })}
        testID="today-tree"
        style={[styles.treeSpot, { height: treeHeight + 26 }]}
      >
        <Svg width={190} height={36} style={styles.mound}>
          <Defs>
            <RadialGradient id="todayMound" cx="50%" cy="40%" r="60%">
              <Stop offset="0" stopColor={isDark ? '#3E6248' : '#9CC07A'} />
              <Stop offset="1" stopColor={isDark ? '#2A4636' : '#78A35E'} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={95} cy={22} rx={92} ry={14} fill="url(#todayMound)" />
        </Svg>
        <Animated.View
          style={[styles.tree, { height: treeHeight, width: treeHeight * TREE_ASPECT }, treeStyle]}
        >
          <Image source={treeArt(level)} style={styles.fill} resizeMode="contain" />
          {/* NOTE: Ночью дерево темнеет тем же силуэтом — как предметы в мире первого запуска. */}
          <Animated.Image
            source={treeArt(level)}
            style={[styles.fill, styles.dim, dimStyle]}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
      {streak > 0 ? (
        <View style={styles.streak} testID="today-streak">
          <Animated.View style={flameStyle} testID="today-flame">
            <Animated.View style={[styles.flameLayer, coldStyle]}>
              <Icon name="flame" size={18} color="#9AA39A" strokeWidth={2} />
            </Animated.View>
            <Animated.View style={warmStyle}>
              <Icon name="flame" size={18} color={flameColor(streak)} strokeWidth={2} />
            </Animated.View>
          </Animated.View>
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
  flameLayer: { position: 'absolute', left: 0, top: 0 },
  streakText: {
    color: '#8F4520',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    maxWidth: 92,
    lineHeight: 17,
  },
});
