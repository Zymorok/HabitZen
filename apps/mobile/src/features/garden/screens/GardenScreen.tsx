import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAuth } from '../../../core/auth/AuthProvider';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { useHaptics } from '../../../shared/haptics';
import { useMotionPolicy } from '../../../shared/motion/useMotionPolicy';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useGarden } from '../data/useGarden';
import { stageCards } from '../stage';
import { TREE_ASPECT, treeArt } from '../tree-art';

import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';

const SEEN_KEY = 'habitzen.garden.seen-level.v1';

/**
 * Кадр 10 «Твоё дерево»: дерево текущего уровня на холмах, уровень, прогресс до следующего
 * и карточки стадий роста. Если с прошлого раза уровень вырос — дерево «дорастает» на глазах.
 */
export function GardenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation(['progress', 'common', 'errors']);
  const { theme, night, isDark } = useAppPreferences();
  const { session } = useAuth();
  const garden = useGarden();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));
  const fill = useSharedValue(0);
  const level = garden.data?.level ?? 1;
  const share = garden.data?.needed ? garden.data.progress / garden.data.needed : 1;
  useEffect(() => {
    fill.value = withDelay(250, withTiming(share, { duration: 800 }));
  }, [share, fill]);
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (garden.isPending) {
    return (
      <View style={[styles.shell, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (garden.isError) {
    return (
      <View
        style={[styles.shell, styles.center, { backgroundColor: theme.background, padding: 24 }]}
      >
        <AppText style={{ color: theme.error, textAlign: 'center' }}>
          {t(errorMessageKey(garden.error))}
        </AppText>
        <Button label={t('common:retry')} variant="outline" onPress={() => void garden.refetch()} />
      </View>
    );
  }
  const sceneHeight = Math.round(Math.min(380, Math.max(280, width * 0.86)));
  const cardWidth = (Math.min(width, 520) - 40 - 30) / 4;

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="garden-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <IconButton
            accessibilityLabel={t('common:back')}
            onPress={() => router.back()}
            testID="garden-back"
          >
            <View style={styles.flip}>
              <Icon name="arrow" color={theme.text} />
            </View>
          </IconButton>
          <ThemedText variant="title" style={styles.title}>
            {t('progress:tree')}
          </ThemedText>
          <View style={styles.headerGap} />
        </View>

        <GardenScene
          level={level}
          height={sceneHeight}
          width={width}
          isDark={isDark}
          userId={session?.user.id ?? ''}
        />

        <View style={styles.body}>
          <AppText style={styles.level} testID="garden-level">
            {t('progress:level', { level })}
          </AppText>
          <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
            <Animated.View style={[styles.bar, { backgroundColor: theme.success }, barStyle]} />
          </View>
          <AppText style={[styles.next, { color: theme.textMuted }]} testID="garden-next">
            {garden.data?.needed
              ? t('progress:next_level', {
                  progress: garden.data.progress,
                  needed: garden.data.needed,
                })
              : t('progress:max_level')}
          </AppText>

          <View style={styles.cards}>
            {stageCards(level).map((cardLevel, index) => {
              const open = cardLevel <= level;
              const current = cardLevel === level;
              return (
                <Animated.View
                  key={cardLevel}
                  entering={FadeInDown.delay(120 + index * 70).duration(320)}
                  accessible
                  accessibilityLabel={
                    open
                      ? t('progress:level', { level: cardLevel })
                      : t('progress:stage_locked', { level: cardLevel })
                  }
                  testID={current ? 'garden-card-current' : 'garden-card'}
                  style={[
                    styles.card,
                    {
                      width: cardWidth,
                      backgroundColor: current ? theme.surfaceMuted : theme.surface,
                      borderColor: current ? theme.primarySoft : theme.border,
                    },
                  ]}
                >
                  <Image
                    source={treeArt(cardLevel)}
                    style={{
                      width: cardWidth * 0.82,
                      height: cardWidth * 0.82,
                      opacity: open ? 1 : 0.28,
                    }}
                    resizeMode="contain"
                  />
                  <AppText
                    maxFontSizeMultiplier={1.2}
                    style={[styles.cardLabel, { color: open ? theme.text : theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {t('progress:level', { level: cardLevel })}
                  </AppText>
                </Animated.View>
              );
            })}
          </View>

          <AppText style={styles.hint}>{t('progress:growth_hint')}</AppText>
          {garden.data && garden.data.perfectDays > 0 ? (
            <View style={styles.perfect} testID="garden-perfect-days">
              <Icon name="crown" size={16} color="#E39A3B" fill="#F6C66B" strokeWidth={1.6} />
              <AppText style={styles.perfectText}>
                {t('progress:perfect_days', { count: garden.data.perfectDays })}
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

/**
 * Небо, солнце, холмы и дерево. Дерево тихо покачивается; если уровень вырос с прошлого
 * посещения, прежняя стадия растворяется, новая вырастает пружиной и появляется «Новый уровень!».
 */
function GardenScene({
  level,
  height,
  width,
  isDark,
  userId,
}: {
  readonly level: number;
  readonly height: number;
  readonly width: number;
  readonly isDark: boolean;
  readonly userId: string;
}) {
  const { t } = useTranslation('progress');
  const { animate } = useMotionPolicy();
  const haptics = useHaptics();
  const [previous, setPrevious] = useState<number | null>(null);
  const grow = useSharedValue(1);
  const sway = useSharedValue(0);
  // NOTE: Экран живёт среди вкладок и не пересоздаётся, поэтому рост проверяется каждый раз,
  // когда дерево снова на виду: сравниваем уровень с последним показанным на этом устройстве.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let active = true;
      const key = `${SEEN_KEY}:${userId}`;
      void (async () => {
        let seen: number | null = null;
        try {
          const raw = await AsyncStorage.getItem(key);
          seen = raw ? Number(raw) : null;
          await AsyncStorage.setItem(key, String(level));
        } catch {
          /* NOTE: Без памяти о прошлом уровне дерево просто показывается без роста. */
        }
        if (!active || seen === null || !Number.isFinite(seen) || seen >= level) return;
        setPrevious(seen);
        // NOTE: При «Меньше движения» новое дерево просто проявляется, без пружинного роста.
        if (animate) {
          grow.value = 0.62;
          grow.value = withDelay(350, withSpring(1, { damping: 7, stiffness: 90 }));
        }
        haptics.success();
      })();
      return () => {
        active = false;
        // NOTE: «Новый уровень!» показывается один раз — при уходе с экрана подсказка убирается.
        setPrevious(null);
      };
    }, [userId, level, grow, animate, haptics]),
  );

  useEffect(() => {
    if (!animate) return;
    sway.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [animate, sway]);

  const treeStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(sway.value, [0, 1], [-1.2, 1.2])}deg` },
      { scale: grow.value },
    ],
  }));
  const oldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(grow.value, [0.62, 1], [1, 0]),
  }));
  const treeHeight = height * 0.84;
  const hillsWidth = Math.min(width, 520) * 1.25;

  return (
    <View style={[styles.scene, { height }]} testID="garden-scene">
      <LinearGradient
        colors={isDark ? ['#14231E', '#21423F'] : ['#FCF7EA', '#EEF2DC']}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={140} height={140} style={styles.sun}>
        <Defs>
          <RadialGradient id="gardenSun" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={isDark ? '#F2EBD3' : '#FBE7A8'} stopOpacity={1} />
            <Stop offset="0.45" stopColor={isDark ? '#E3DDC6' : '#F7DC93'} stopOpacity={0.9} />
            <Stop offset="1" stopColor={isDark ? '#E3DDC6' : '#F7DC93'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={70} cy={70} r={70} fill="url(#gardenSun)" />
      </Svg>
      <Image
        source={isDark ? hillsNight : hillsDay}
        style={[
          styles.hills,
          { width: hillsWidth, height: hillsWidth / 1.5, left: (width - hillsWidth) / 2 },
        ]}
        resizeMode="cover"
      />
      <View style={styles.treeSpot} pointerEvents="none">
        <Svg width={230} height={40} style={styles.mound}>
          <Defs>
            <RadialGradient id="gardenMound" cx="50%" cy="40%" r="60%">
              <Stop offset="0" stopColor={isDark ? '#3E6248' : '#A5C67F'} />
              <Stop offset="1" stopColor={isDark ? '#2A4636' : '#7FA862'} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={115} cy={24} rx={112} ry={15} fill="url(#gardenMound)" />
        </Svg>
        {previous !== null ? (
          <Animated.Image
            source={treeArt(previous)}
            style={[
              styles.tree,
              {
                width: treeHeight * TREE_ASPECT,
                height: treeHeight,
                position: 'absolute',
                bottom: 10,
              },
              oldStyle,
            ]}
            resizeMode="contain"
          />
        ) : null}
        <Animated.Image
          source={treeArt(level)}
          style={[
            styles.tree,
            { width: treeHeight * TREE_ASPECT, height: treeHeight, marginBottom: 10 },
            treeStyle,
          ]}
          resizeMode="contain"
          accessible
          accessibilityLabel={t('tree_a11y', { level })}
          testID="garden-tree"
        />
      </View>
      {previous !== null ? (
        <Animated.View
          entering={ZoomIn.delay(700).springify().damping(12)}
          style={styles.levelUp}
          testID="garden-level-up"
        >
          <Icon name="sprout" size={16} color="#3E7D50" fill="#86B283" strokeWidth={1.6} />
          <AppText style={styles.levelUpText}>{t('level_up')}</AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 4 },
  flip: { transform: [{ scaleX: -1 }] },
  title: { flex: 1, textAlign: 'center', fontSize: 22, lineHeight: 30 },
  headerGap: { width: 48 },
  scene: { width: '100%', overflow: 'hidden' },
  sun: { position: 'absolute', right: 18, top: 8 },
  hills: { position: 'absolute', bottom: -40 },
  treeSpot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mound: { position: 'absolute', bottom: -4 },
  tree: { transformOrigin: '50% 100%' },
  levelUp: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(232,244,226,0.95)',
    width: 160,
  },
  levelUpText: { flex: 1, color: '#2D6249', fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
  body: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 14,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  level: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 6 },
  next: { fontSize: 15, textAlign: 'center', alignSelf: 'stretch' },
  cards: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  cardLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  perfect: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,236,214,0.95)',
    width: 190,
  },
  perfectText: { flex: 1, color: '#8F4520', fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
});
