import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useWorld } from '../world/WorldContext';
import { DemoCard } from './DemoCard';
import type { Translate } from './DemoCard';

const SHOW_MS = 3400;
const HIDE_MS = 1700;

/** Страница 5: уведомление выезжает сверху, колокольчик покачивается, потом уведомление уходит. */
export function ReminderDemo({ t, active }: { readonly t: Translate; readonly active: boolean }) {
  const { theme } = useAppPreferences();
  const { animate } = useWorld();
  const shown = useSharedValue(1);
  const bell = useSharedValue(0);

  useEffect(() => {
    if (!active || !animate) {
      shown.value = 1;
      bell.value = 0;
      return;
    }
    const ring = () =>
      withSequence(
        withTiming(1, { duration: 90 }),
        withRepeat(
          withSequence(withTiming(-1, { duration: 120 }), withTiming(1, { duration: 120 })),
          3,
        ),
        withTiming(0, { duration: 120 }),
      );
    const cycle = () => {
      shown.value = 0;
      bell.value = withDelay(250, ring());
      shown.value = withSequence(
        withSpring(1, { damping: 13, stiffness: 140 }),
        withDelay(SHOW_MS, withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) })),
      );
    };
    cycle();
    const timer = setInterval(cycle, SHOW_MS + HIDE_MS + 600);
    return () => {
      clearInterval(timer);
      cancelAnimation(shown);
      cancelAnimation(bell);
    };
  }, [active, animate, shown, bell]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (shown.value - 1) * 46 }, { scale: 0.94 + shown.value * 0.06 }],
  }));
  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bell.value * 16}deg` }],
  }));
  return (
    <Animated.View style={[styles.wrap, bannerStyle]} testID="demo-reminder">
      <DemoCard style={styles.banner}>
        <View style={[styles.appIcon, { backgroundColor: theme.surfaceMuted }]}>
          <Animated.View style={[{ transformOrigin: '50% 10%' }, bellStyle]}>
            <Icon name="bell" size={20} color={theme.primary} />
          </Animated.View>
        </View>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <ThemedText variant="button" style={styles.app}>
              HabitZen
            </ThemedText>
            <ThemedText variant="small" tone="textMuted">
              {t('demo_now')}
            </ThemedText>
          </View>
          <ThemedText style={styles.body} numberOfLines={2}>
            {t('demo_reminder')}
          </ThemedText>
        </View>
      </DemoCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 340, alignSelf: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  app: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 13, lineHeight: 19 },
});
