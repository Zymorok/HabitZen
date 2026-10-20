import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useHaptics } from '../../../shared/haptics';
import { AppText } from '../../../shared/ui/AppText';
import { useNewAchievement } from '../useAchievements';
import { Badge } from './Badge';

/**
 * «Новое достижение!» (HZ-10): плашка выезжает сверху на главном экране, через пять секунд
 * уходит сама; нажатие открывает экран достижений.
 */
export function AchievementToast() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('progress');
  const { theme } = useAppPreferences();
  const haptics = useHaptics();
  const { fresh, dismiss } = useNewAchievement();

  useEffect(() => {
    if (!fresh) return;
    haptics.success();
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [fresh, dismiss, haptics]);

  if (!fresh) return null;
  return (
    <Animated.View
      entering={SlideInUp.springify().damping(16)}
      exiting={FadeOutUp.duration(250)}
      style={[styles.wrap, { top: Math.max(insets.top, 12) + 6 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          dismiss();
          router.push('/achievements');
        }}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t('achievement_new')}: ${t(`ach_${fresh.key}_title`)}`}
        testID="achievement-toast"
        style={[styles.toast, { backgroundColor: theme.surface, borderColor: '#E8B661' }]}
      >
        <Badge icon={fresh.icon} unlocked size={44} />
        <View style={styles.text}>
          <AppText variant="small" style={styles.label}>
            {t('achievement_new')}
          </AppText>
          <AppText style={styles.title} numberOfLines={1}>
            {t(`ach_${fresh.key}_title`)}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 20, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 440,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    boxShadow: '0 12px 28px rgba(18,47,32,0.18)',
  },
  text: { flex: 1, gap: 1 },
  label: { color: '#B5741F', fontFamily: 'Manrope_700Bold', alignSelf: 'stretch' },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 16, alignSelf: 'stretch' },
});
