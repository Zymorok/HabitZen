import { ActivityIndicator, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { Badge, goldText } from '../components/Badge';
import { useAchievements } from '../useAchievements';
import type { Achievement } from '../rules';

/**
 * «Достижения» (HZ-10): медали за серии, полные дни, число выполнений и рост дерева.
 * Открытые — золотые, закрытые — с замочком и полоской «3 из 7».
 * NOTE: Раскладка — классы NativeWind (HZ-11): на телефоне две медали в ряд, на широком
 * экране (md) — три. Цвета темы остаются в style, потому что меняются вместе с темой.
 */
export function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['progress', 'common']);
  const { theme, night, palette } = useAppPreferences();
  const list = useAchievements();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));
  const done = list?.filter((item) => item.unlocked).length ?? 0;

  return (
    <Animated.View
      style={[{ flex: 1, paddingTop: Math.max(insets.top, 12) }, shellStyle]}
      testID="achievements-screen"
    >
      <View className="flex-row items-center px-2.5">
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="achievements-back"
        >
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="button" style={{ flex: 1, textAlign: 'center', fontSize: 17 }}>
          {t('progress:achievements_title')}
        </ThemedText>
        <View className="w-11" />
      </View>
      <ScrollView
        contentContainerClassName="w-full max-w-screen self-center gap-3 px-4 md:max-w-[760px]"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 12 }}
      >
        {list === null ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <>
            <AppText
              className="self-stretch text-center"
              style={{ color: theme.textMuted, fontSize: 14 }}
              testID="achievements-count"
            >
              {t('progress:achievements_count', { done, total: list.length })}
            </AppText>
            <View className="flex-row flex-wrap gap-2.5">
              {list.map((item, index) => (
                <Card key={item.key} item={item} index={index} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Card({ item, index }: { readonly item: Achievement; readonly index: number }) {
  const { t } = useTranslation('progress');
  const { theme, isDark } = useAppPreferences();
  const title = t(`ach_${item.key}_title`);
  const state = item.unlocked
    ? t('achievement_got')
    : t('achievement_progress', { value: item.value, goal: item.goal });
  return (
    // NOTE: Ширина ячейки — адаптивный класс: 48 % на телефоне, 31 % на планшете и в браузере.
    <View className="w-[48%] grow md:w-[31%]">
      {/* NOTE: Анимация появления — на Reanimated, сама карточка — на классах NativeWind. */}
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}
        style={{ flex: 1 }}
      >
        <View
          className="flex-1 items-center gap-1.5 rounded-[20px] border px-3 py-4"
          style={{
            backgroundColor: theme.surface,
            borderColor: item.unlocked ? '#E8B661' : theme.border,
          }}
          accessible
          accessibilityLabel={`${title}. ${t(`ach_${item.key}_body`)}. ${state}`}
          testID={`achievement-${item.key}`}
        >
          <Badge icon={item.icon} unlocked={item.unlocked} />
          <AppText
            className="mt-1 self-stretch text-center"
            style={{ fontFamily: 'Manrope_700Bold', fontSize: 15 }}
            numberOfLines={2}
          >
            {title}
          </AppText>
          <AppText
            variant="small"
            className="min-h-[34px] self-stretch text-center"
            style={{ color: theme.textMuted }}
            numberOfLines={3}
          >
            {t(`ach_${item.key}_body`)}
          </AppText>
          {item.unlocked ? (
            <AppText
              variant="small"
              style={{ color: goldText(isDark), fontFamily: 'Manrope_700Bold' }}
              testID="achievement-got"
            >
              {state}
            </AppText>
          ) : (
            <View className="items-center gap-1 self-stretch">
              <View
                className="h-1.5 self-stretch overflow-hidden rounded-full"
                style={{ backgroundColor: theme.surfaceMuted }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: theme.primary,
                    width: `${(item.value / item.goal) * 100}%`,
                  }}
                />
              </View>
              <AppText variant="small" style={{ color: theme.textMuted }}>
                {state}
              </AppText>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
