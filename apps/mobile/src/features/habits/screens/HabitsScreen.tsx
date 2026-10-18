import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { resetTo } from '../../../navigation/reset-to';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAuth } from '../../../core/auth/AuthProvider';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { TextField } from '../../../shared/ui/TextField';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { AppText } from '../../../shared/ui/AppText';
import { CATEGORY_LOOK, newRequestId } from '../data/habits-api';
import type { Habit, HabitCategory, HabitColor } from '../data/habits-api';
import {
  useActiveHabits,
  useArchiveHabit,
  useCreateHabit,
  useDisplayName,
} from '../data/useHabits';
import { ALL_WEEKDAYS, describeWeekdays, hasWeekday, toggleWeekday } from '../weekdays';

const CATEGORIES: readonly HabitCategory[] = [
  'water',
  'reading',
  'fitness',
  'meditation',
  'learning',
  'custom',
];
// NOTE: Цвета палитры привычек — те же, что разрешены в базе (color_key).
const SWATCH: Readonly<Record<HabitColor, string>> = {
  sage: '#5B8C63',
  mint: '#5FAF95',
  apricot: '#E98A55',
  sand: '#C9A15F',
  blue: '#6C98C9',
  rose: '#D27F8E',
};

/**
 * Временный экран после входа (HZ-03): привычки хранятся на сервере, их можно добавить и убрать в архив.
 * TODO(HZ-04): Заменить на «План на день» по кадрам 02–05 макета (удержание, отмена, «Сегодня отдых»).
 */
export function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['habits', 'auth', 'errors', 'common']);
  const { status, signOut } = useAuth();
  const { theme, night, isDark } = useAppPreferences();
  const habits = useActiveHabits();
  const name = useDisplayName();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));

  if (status === 'signedOut' || status === 'unconfigured') return <Redirect href="/" />;

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="habits-screen">
      <LinearGradient
        pointerEvents="none"
        colors={isDark ? ['#132833', 'rgba(20,35,30,0)'] : ['#EEF1E0', 'rgba(251,248,239,0)']}
        style={styles.glow}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText variant="title" style={styles.hello} testID="habits-hello">
              {name.data ? t('habits:hello', { name: name.data }) : t('habits:greeting')}
            </ThemedText>
            <ThemedText tone="textMuted" variant="small">
              {t('habits:stored_note')}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t('auth:sign_out')}
            testID="sign-out"
            onPress={() => {
              void signOut().then(() => resetTo(router, '/'));
            }}
          >
            <Icon name="logout" color={theme.text} />
          </IconButton>
        </View>

        <ThemedText variant="title" style={styles.section}>
          {t('habits:my_habits')}
        </ThemedText>
        {habits.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
            <ThemedText tone="textMuted" variant="small">
              {t('habits:loading_habits')}
            </ThemedText>
          </View>
        ) : habits.isError ? (
          <View style={styles.center}>
            <AppText style={{ color: theme.error, textAlign: 'center' }} testID="habits-load-error">
              {t(errorMessageKey(habits.error))}
            </AppText>
            <Button
              label={t('common:retry')}
              variant="outline"
              onPress={() => void habits.refetch()}
            />
          </View>
        ) : habits.data.length === 0 ? (
          <Animated.View
            entering={FadeInDown.duration(320)}
            style={styles.empty}
            testID="habits-empty"
          >
            <ThemedText variant="button">{t('habits:empty_title')}</ThemedText>
            <ThemedText tone="textMuted" style={styles.emptyBody}>
              {t('habits:empty_body')}
            </ThemedText>
          </Animated.View>
        ) : (
          <View style={styles.list} testID="habits-list">
            {habits.data.map((habit, index) => (
              <HabitRow key={habit.id} habit={habit} index={index} />
            ))}
          </View>
        )}

        <NewHabitCard />
      </ScrollView>
    </Animated.View>
  );
}

function HabitRow({ habit, index }: { readonly habit: Habit; readonly index: number }) {
  const { t } = useTranslation(['habits', 'errors']);
  const { theme } = useAppPreferences();
  const archive = useArchiveHabit();
  const [requestId] = useState(newRequestId);
  const days = describeWeekdays(
    habit.weekdayMask,
    t('habits:weekdays_short').split(','),
    t('habits:every_day'),
  );
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(240)}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="habit-row"
    >
      <View style={[styles.badge, { backgroundColor: SWATCH[habit.colorKey] + '26' }]}>
        <Icon name={habit.iconKey as IconName} size={18} color={SWATCH[habit.colorKey]} />
      </View>
      <View style={styles.rowText}>
        <AppText style={styles.rowTitle} numberOfLines={2}>
          {habit.title}
        </AppText>
        <AppText variant="small" style={{ color: theme.textMuted }}>
          {days}
        </AppText>
        {archive.isError ? (
          <AppText variant="small" style={{ color: theme.error }}>
            {t(errorMessageKey(archive.error))}
          </AppText>
        ) : null}
      </View>
      <IconButton
        accessibilityLabel={t('habits:archive')}
        testID="habit-archive"
        onPress={() => archive.mutate({ habit, requestId })}
      >
        <Icon name="archive" size={19} color={theme.textMuted} />
      </IconButton>
    </Animated.View>
  );
}

function NewHabitCard() {
  const { t } = useTranslation(['habits', 'errors']);
  const { theme } = useAppPreferences();
  const create = useCreateHabit();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitCategory>('reading');
  const [mask, setMask] = useState(ALL_WEEKDAYS);
  const [requestId, setRequestId] = useState(newRequestId);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const shortNames = t('habits:weekdays_short').split(',');

  // NOTE: Любая правка формы — уже другое действие, ему нужен новый номер запроса.
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setRequestId(newRequestId());
      setSaved(false);
    };

  const submit = () => {
    if (create.isPending) return;
    if (!title.trim()) return setProblem(t('habits:title_required'));
    if (!mask) return setProblem(t('habits:days_required'));
    setProblem(null);
    create.mutate(
      { habit: { title: title.trim(), category, weekdayMask: mask }, requestId },
      {
        onSuccess: () => {
          setTitle('');
          setMask(ALL_WEEKDAYS);
          setRequestId(newRequestId());
          setSaved(true);
        },
      },
    );
  };

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="new-habit"
    >
      <View style={styles.cardTitle}>
        <Icon name="plus" size={18} color={theme.primary} />
        <ThemedText variant="button">{t('habits:new_habit')}</ThemedText>
      </View>
      <TextField
        label={t('habits:title_label')}
        placeholder={t('habits:title_placeholder')}
        value={title}
        onChangeText={edit(setTitle)}
        maxLength={120}
        testID="new-habit-title"
      />
      <ThemedText variant="small" tone="textMuted" style={styles.groupLabel}>
        {t('habits:category')}
      </ThemedText>
      <View style={styles.chips}>
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            label={t(`habits:category_${item}`)}
            icon={CATEGORY_LOOK[item].icon as IconName}
            color={SWATCH[CATEGORY_LOOK[item].color]}
            selected={category === item}
            onPress={() => edit(setCategory)(item)}
            testID={`category-${item}`}
          />
        ))}
      </View>
      <ThemedText variant="small" tone="textMuted" style={styles.groupLabel}>
        {t('habits:weekdays')}
      </ThemedText>
      <View style={styles.days}>
        {shortNames.map((label, day) => (
          <Pressable
            key={label}
            onPress={() => edit(setMask)(toggleWeekday(mask, day))}
            accessibilityRole="checkbox"
            aria-checked={hasWeekday(mask, day)}
            accessibilityLabel={label}
            testID={`weekday-${day}`}
            style={[
              styles.day,
              hasWeekday(mask, day)
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { borderColor: theme.border },
            ]}
          >
            <AppText
              variant="small"
              style={{
                color: hasWeekday(mask, day) ? theme.background : theme.textMuted,
                fontFamily: 'Manrope_600SemiBold',
              }}
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {problem || create.isError ? (
        <AppText variant="small" style={{ color: theme.error }} testID="new-habit-error">
          {problem ?? t(errorMessageKey(create.error))}
        </AppText>
      ) : saved ? (
        <AppText variant="small" style={{ color: theme.success }} testID="new-habit-saved">
          {t('habits:created')}
        </AppText>
      ) : null}
      <Button
        label={create.isPending ? t('habits:saving') : t('habits:create')}
        onPress={submit}
        disabled={create.isPending}
        testID="new-habit-submit"
      />
    </View>
  );
}

function Chip({
  label,
  icon,
  color,
  selected,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly icon: IconName;
  readonly color: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      testID={testID}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      // WARNING: Не стиль-функция ({ pressed }) => …: на Android она теряет оформление кнопки.
      style={[
        styles.chip,
        {
          borderColor: selected ? color : theme.border,
          backgroundColor: selected ? color + '22' : 'transparent',
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Icon name={icon} size={15} color={color} />
      <AppText variant="small" style={{ fontFamily: 'Manrope_500Medium' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 300 },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerText: { flex: 1, gap: 4 },
  hello: { fontSize: 24, lineHeight: 32 },
  section: { fontSize: 19, lineHeight: 26, marginTop: 6 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  empty: { alignItems: 'center', gap: 4, paddingVertical: 14 },
  emptyBody: { textAlign: 'center', maxWidth: 300 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 6px 18px rgba(18,47,32,0.06)',
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, lineHeight: 21 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 10, marginTop: 6 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupLabel: { fontFamily: 'Manrope_500Medium', paddingHorizontal: 4, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1.25,
  },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
