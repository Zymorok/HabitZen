import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { COLOR_ORDER, HABIT_COLORS, ICON_CHOICES } from '../../../shared/habit-look';
import type { HabitColor } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
import { TextField } from '../../../shared/ui/TextField';
import { ThemedText } from '../../../shared/ui/ThemedText';
import { useNotificationPermission } from '../../../platform/permissions/useNotificationPermission';
import { useSaveSettings, useUserSettings } from '../../settings/data/useSettings';
import { newRequestId } from '../data/habits-api';
import { useActiveHabits, useSaveHabit } from '../data/useHabits';
import { ALL_WEEKDAYS, hasWeekday, toggleWeekday } from '../weekdays';
import { shiftTime } from '../time';
import {
  clampGoal,
  defaultTarget,
  GOAL_UNITS,
  goalStep,
  isCountGoal,
  MAX_GOAL,
  TIMES_OF_DAY,
} from '../goal';
import type { Frequency, GoalUnit, TimeOfDay } from '../goal';
import { Chip, NumberStepper } from '../components/FormControls';

/**
 * Кадр 03 «Новая привычка» (и изменение существующей по ?id=…):
 * название, значок, цвет, цель на день, как часто, время дня, время и напоминание.
 * NOTE: Цель, график и время дня добавлены в HZ-08 в том же стиле, что и дни недели.
 */
export function HabitFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['habits', 'errors', 'common']);
  const { theme, night, palette } = useAppPreferences();
  const habits = useActiveHabits();
  const save = useSaveHabit();
  const existing = useMemo(() => habits.data?.find((habit) => habit.id === id), [habits.data, id]);

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]!);
  const [color, setColor] = useState<HabitColor>('sage');
  const [mask, setMask] = useState(ALL_WEEKDAYS);
  const [time, setTime] = useState('21:00');
  const [reminders, setReminders] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [goalCount, setGoalCount] = useState(false);
  const [goalUnit, setGoalUnit] = useState<GoalUnit>('glasses');
  const [goalTarget, setGoalTarget] = useState(defaultTarget('glasses'));
  const [frequency, setFrequency] = useState<Frequency>('days');
  const [perWeek, setPerWeek] = useState(3);
  const [intervalDays, setIntervalDays] = useState(2);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const settings = useUserSettings();
  const saveSettings = useSaveSettings();
  const permission = useNotificationPermission();
  const [requestId, setRequestId] = useState(newRequestId);
  const [problem, setProblem] = useState<string | null>(null);

  // NOTE: В режиме изменения форма один раз заполняется сохранёнными значениями.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setIcon(ICON_CHOICES.find((choice) => choice.icon === existing.iconKey) ?? ICON_CHOICES[0]!);
    setColor(existing.colorKey);
    setMask(existing.weekdayMask);
    setReminders(existing.reminderTimes.length > 0);
    if (existing.reminderTimes[0]) setTime(existing.reminderTimes[0]);
    setGoalCount(isCountGoal(existing.goalTarget, existing.goalUnit));
    if (isCountGoal(existing.goalTarget, existing.goalUnit)) {
      setGoalUnit(existing.goalUnit);
      setGoalTarget(existing.goalTarget);
    }
    setFrequency(existing.frequency);
    if (existing.perWeek) setPerWeek(existing.perWeek);
    if (existing.intervalDays) setIntervalDays(existing.intervalDays);
    setTimeOfDay(existing.timeOfDay);
  }, [existing]);

  // NOTE: Любая правка — уже другое действие, ему нужен новый номер запроса.
  const touch = () => setRequestId(newRequestId());
  const shortNames = t('habits:weekdays_short').split(',');
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [palette.light.background, palette.dark.background],
    ),
  }));

  const submit = () => {
    if (save.isPending) return;
    if (!title.trim()) return setProblem(t('habits:title_required'));
    if (frequency === 'days' && !mask) return setProblem(t('habits:days_required'));
    setProblem(null);
    save.mutate(
      {
        draft: {
          title: title.trim(),
          category: icon.category,
          iconKey: icon.icon,
          colorKey: color,
          weekdayMask: frequency === 'days' ? mask : ALL_WEEKDAYS,
          reminderTimes: reminders ? [time] : [],
          goalTarget: goalCount ? goalTarget : 1,
          goalUnit: goalCount ? goalUnit : 'times',
          timeOfDay,
          frequency,
          perWeek: frequency === 'weekly' ? perWeek : null,
          intervalDays: frequency === 'interval' ? intervalDays : null,
        },
        ...(existing ? { existing } : {}),
        requestId,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Animated.View style={[styles.shell, shellStyle]} testID="habit-form">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <IconButton
            accessibilityLabel={t('common:back')}
            onPress={() => router.back()}
            testID="form-back"
          >
            <View style={styles.backIcon}>
              <Icon name="arrow" color={theme.text} />
            </View>
          </IconButton>
          <ThemedText variant="button" style={styles.headerTitle}>
            {existing ? t('habits:edit_habit') : t('habits:new_habit')}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 18) + 8 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(320)}>
            <TextField
              label={t('habits:title_label')}
              placeholder={t('habits:title_placeholder')}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                touch();
              }}
              maxLength={120}
              testID="form-title"
            />
          </Animated.View>

          <Section label={t('habits:icon')}>
            <View style={styles.iconRow}>
              {ICON_CHOICES.map((choice) => {
                const selected = choice.icon === icon.icon;
                return (
                  <Pressable
                    key={choice.icon}
                    onPress={() => {
                      setIcon(choice);
                      touch();
                    }}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    accessibilityLabel={t(`habits:category_${choice.category}`)}
                    testID={`form-icon-${choice.icon}`}
                    style={[
                      styles.iconTile,
                      selected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { borderColor: theme.border, backgroundColor: theme.surface },
                    ]}
                  >
                    <Icon
                      name={choice.icon}
                      size={22}
                      color={selected ? theme.background : theme.primary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section label={t('habits:color')}>
            <View style={styles.colorRow}>
              {COLOR_ORDER.map((key) => {
                const selected = key === color;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setColor(key);
                      touch();
                    }}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    accessibilityLabel={key}
                    testID={`form-color-${key}`}
                    style={[
                      styles.colorOuter,
                      { borderColor: selected ? HABIT_COLORS[key] : 'transparent' },
                    ]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: HABIT_COLORS[key] }]} />
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section label={t('habits:goal')}>
            <View style={styles.chips}>
              <Chip
                label={t('habits:goal_check')}
                selected={!goalCount}
                onPress={() => {
                  setGoalCount(false);
                  touch();
                }}
                testID="form-goal-check"
              />
              <Chip
                label={t('habits:goal_count')}
                selected={goalCount}
                onPress={() => {
                  setGoalCount(true);
                  touch();
                }}
                testID="form-goal-count"
              />
            </View>
            {goalCount ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.section}>
                <NumberStepper
                  value={goalTarget}
                  label={t(`habits:unit_word_${goalUnit}`, { count: goalTarget })}
                  min={1}
                  max={MAX_GOAL}
                  step={goalStep(goalUnit)}
                  onChange={(value) => {
                    setGoalTarget(clampGoal(value));
                    touch();
                  }}
                  testID="form-goal"
                />
                <View style={styles.chips}>
                  {GOAL_UNITS.map((unit) => (
                    <Chip
                      key={unit}
                      label={t(`habits:unit_name_${unit}`)}
                      selected={unit === goalUnit}
                      onPress={() => {
                        setGoalUnit(unit);
                        setGoalTarget(defaultTarget(unit));
                        touch();
                      }}
                      testID={`form-unit-${unit}`}
                      // NOTE: Шесть единиц — ровная сетка 3 × 2, а не 4 + 2 разной ширины.
                      style={styles.unitChip}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </Section>

          <Section label={t('habits:frequency')}>
            <View style={styles.chips}>
              {(['days', 'weekly', 'interval'] as const).map((kind) => (
                <Chip
                  key={kind}
                  label={t(`habits:freq_${kind}`)}
                  selected={frequency === kind}
                  onPress={() => {
                    setFrequency(kind);
                    touch();
                  }}
                  testID={`form-freq-${kind}`}
                />
              ))}
            </View>
            {frequency === 'days' ? (
              <View style={styles.days}>
                {shortNames.map((label, day) => {
                  const on = hasWeekday(mask, day);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        setMask(toggleWeekday(mask, day));
                        touch();
                      }}
                      accessibilityRole="checkbox"
                      aria-checked={on}
                      accessibilityLabel={label}
                      testID={`form-day-${day}`}
                      style={[
                        styles.day,
                        on
                          ? { backgroundColor: theme.primary, borderColor: theme.primary }
                          : { borderColor: theme.border, backgroundColor: theme.surface },
                      ]}
                    >
                      <AppText
                        variant="small"
                        style={{
                          color: on ? theme.background : theme.textMuted,
                          fontFamily: 'Manrope_600SemiBold',
                        }}
                      >
                        {label.toUpperCase()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : frequency === 'weekly' ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.section}>
                <NumberStepper
                  value={perWeek}
                  label={t('habits:per_week_unit', { count: perWeek })}
                  min={1}
                  max={6}
                  onChange={(value) => {
                    setPerWeek(value);
                    touch();
                  }}
                  testID="form-per-week"
                />
                <AppText variant="small" style={[styles.hint, { color: theme.textMuted }]}>
                  {t('habits:per_week_hint')}
                </AppText>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(200)} style={styles.section}>
                <NumberStepper
                  value={intervalDays}
                  label={t('habits:interval_unit', { count: intervalDays })}
                  min={2}
                  max={14}
                  onChange={(value) => {
                    setIntervalDays(value);
                    touch();
                  }}
                  testID="form-interval"
                />
                <AppText variant="small" style={[styles.hint, { color: theme.textMuted }]}>
                  {t('habits:interval_hint')}
                </AppText>
              </Animated.View>
            )}
          </Section>

          <Section label={t('habits:time_of_day')}>
            <View style={styles.chips}>
              {TIMES_OF_DAY.map((key) => (
                <Chip
                  key={key}
                  label={t(`habits:tod_${key}`)}
                  selected={timeOfDay === key}
                  onPress={() => {
                    setTimeOfDay(key);
                    touch();
                  }}
                  testID={`form-tod-${key}`}
                />
              ))}
            </View>
          </Section>

          <Section label={t('habits:time_label')}>
            <Pressable
              onPress={() => setTimeOpen((open) => !open)}
              accessibilityRole="button"
              testID="form-time"
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Icon name="clock" size={20} color={theme.textMuted} />
              <AppText style={styles.rowText}>{time}</AppText>
              <View style={{ transform: [{ rotate: timeOpen ? '90deg' : '0deg' }] }}>
                <Icon name="arrow" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
            {timeOpen ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.stepper}>
                <Stepper
                  label="−1:00"
                  onPress={() => {
                    setTime(shiftTime(time, -60));
                    touch();
                  }}
                />
                <Stepper
                  label="−0:15"
                  onPress={() => {
                    setTime(shiftTime(time, -15));
                    touch();
                  }}
                />
                <Stepper
                  label="+0:15"
                  onPress={() => {
                    setTime(shiftTime(time, 15));
                    touch();
                  }}
                />
                <Stepper
                  label="+1:00"
                  onPress={() => {
                    setTime(shiftTime(time, 60));
                    touch();
                  }}
                />
              </Animated.View>
            ) : null}
            <View
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Icon name="bell" size={20} color={theme.textMuted} />
              <AppText style={styles.rowText}>{t('habits:reminders_toggle')}</AppText>
              <Switch
                value={reminders}
                onValueChange={(value) => {
                  setReminders(value);
                  touch();
                  if (!value) return;
                  // NOTE: Напоминание у привычки включает напоминания в целом и спрашивает
                  // разрешение телефона — иначе выбранное время ни на что бы не влияло.
                  if (settings.data && !settings.data.remindersEnabled)
                    saveSettings.mutate({ remindersEnabled: true });
                  if (!permission.granted) void permission.request();
                }}
                trackColor={{ true: theme.primary, false: theme.border }}
                thumbColor="#FFFFFF"
                accessibilityLabel={t('habits:reminders_toggle')}
                testID="form-reminders"
              />
            </View>
            {reminders ? (
              <AppText
                variant="small"
                style={{ color: theme.textMuted, paddingHorizontal: 4 }}
                testID="form-reminder-note"
              >
                {permission.state === 'unavailable'
                  ? t('habits:reminder_web')
                  : permission.granted
                    ? t('habits:reminder_note', { time })
                    : t('habits:reminder_permission')}
              </AppText>
            ) : null}
          </Section>

          {problem || save.isError ? (
            <AppText variant="small" style={{ color: theme.error }} testID="form-error">
              {problem ?? t(errorMessageKey(save.error))}
            </AppText>
          ) : null}
          <Button
            label={
              save.isPending
                ? t('habits:saving')
                : existing
                  ? t('habits:save_changes')
                  : t('habits:create')
            }
            onPress={submit}
            disabled={save.isPending}
            testID="form-submit"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Section({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(60).duration(320)} style={styles.section}>
      <ThemedText variant="small" tone="textMuted" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      {children}
    </Animated.View>
  );
}

function Stepper({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  const { theme } = useAppPreferences();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.step, { borderColor: theme.border, backgroundColor: theme.surface }]}
    >
      <AppText variant="small" style={{ fontFamily: 'Manrope_600SemiBold' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  headerSpacer: { width: 44 },
  backIcon: { transform: [{ scaleX: -1 }] },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  section: { gap: 8 },
  sectionLabel: { fontFamily: 'Manrope_500Medium', paddingHorizontal: 4 },
  iconRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  iconTile: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 58,
    borderRadius: 16,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  colorOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  day: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15 },
  stepper: { flexDirection: 'row', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { paddingHorizontal: 4 },
  unitChip: { flexBasis: '30%' },
  step: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
