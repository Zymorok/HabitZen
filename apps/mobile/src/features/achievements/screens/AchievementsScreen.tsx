import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { Badge } from '../components/Badge';
import { useAchievements } from '../useAchievements';
import type { Achievement } from '../rules';

/**
 * «Достижения» (HZ-10): медали за серии, полные дни, число выполнений и рост дерева.
 * Открытые — золотые, закрытые — с замочком и полоской «3 из 7».
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
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 12) }]}
      testID="achievements-screen"
    >
      <View style={styles.topBar}>
        <IconButton
          accessibilityLabel={t('common:back')}
          onPress={() => router.back()}
          testID="achievements-back"
        >
          <View style={styles.flip}>
            <Icon name="arrow" color={theme.text} />
          </View>
        </IconButton>
        <ThemedText variant="button" style={styles.topTitle}>
          {t('progress:achievements_title')}
        </ThemedText>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 12 },
        ]}
      >
        {list === null ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <>
            <AppText
              style={[styles.summary, { color: theme.textMuted }]}
              testID="achievements-count"
            >
              {t('progress:achievements_count', { done, total: list.length })}
            </AppText>
            <View style={styles.grid}>
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
  const { theme } = useAppPreferences();
  const title = t(`ach_${item.key}_title`);
  const state = item.unlocked
    ? t('achievement_got')
    : t('achievement_progress', { value: item.value, goal: item.goal });
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: item.unlocked ? '#E8B661' : theme.border },
      ]}
      accessible
      accessibilityLabel={`${title}. ${t(`ach_${item.key}_body`)}. ${state}`}
      testID={`achievement-${item.key}`}
    >
      <Badge icon={item.icon} unlocked={item.unlocked} />
      <AppText style={styles.cardTitle} numberOfLines={2}>
        {title}
      </AppText>
      <AppText
        variant="small"
        style={[styles.cardBody, { color: theme.textMuted }]}
        numberOfLines={3}
      >
        {t(`ach_${item.key}_body`)}
      </AppText>
      {item.unlocked ? (
        <AppText variant="small" style={styles.got} testID="achievement-got">
          {state}
        </AppText>
      ) : (
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.bar,
                { backgroundColor: theme.primary, width: `${(item.value / item.goal) * 100}%` },
              ]}
            />
          </View>
          <AppText variant="small" style={{ color: theme.textMuted }}>
            {state}
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  spacer: { width: 44 },
  flip: { transform: [{ scaleX: -1 }] },
  content: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  summary: { textAlign: 'center', alignSelf: 'stretch', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  cardBody: { textAlign: 'center', alignSelf: 'stretch', minHeight: 34 },
  got: { color: '#B5741F', fontFamily: 'Manrope_700Bold' },
  progress: { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
});
