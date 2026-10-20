import { randomUUID } from 'expo-crypto';
import { supabase } from '../../../core/supabase/client';
import type { HabitCategory, HabitColor } from '../../../shared/habit-look';
import type { Frequency, GoalUnit, TimeOfDay } from '../goal';

/**
 * Контракт привычек с сервером. Запись — только через именованные команды (RPC):
 * сервер сам проверяет владельца, версию строки и повтор запроса.
 */
export interface Habit {
  readonly id: string;
  readonly title: string;
  readonly category: HabitCategory;
  readonly iconKey: string;
  readonly colorKey: HabitColor;
  readonly revision: number;
  /** Биты 0–6 — понедельник…воскресенье. */
  readonly weekdayMask: number;
  /** Время напоминания «ЧЧ:ММ»; пусто — напоминание выключено. */
  readonly reminderTimes: readonly string[];
  /** Цель на день: 1 раз — «просто отметить», иначе 8 стаканов, 20 минут и т. п. */
  readonly goalTarget: number;
  readonly goalUnit: GoalUnit;
  readonly timeOfDay: TimeOfDay;
  /** По дням недели, «N раз в неделю» или «каждые N дней». */
  readonly frequency: Frequency;
  readonly perWeek: number | null;
  readonly intervalDays: number | null;
}

export interface HabitDraft {
  readonly title: string;
  readonly category: HabitCategory;
  readonly iconKey: string;
  readonly colorKey: HabitColor;
  readonly weekdayMask: number;
  readonly reminderTimes: readonly string[];
  readonly goalTarget: number;
  readonly goalUnit: GoalUnit;
  readonly timeOfDay: TimeOfDay;
  readonly frequency: Frequency;
  readonly perWeek: number | null;
  readonly intervalDays: number | null;
}

/** Номер запроса: один на действие человека, повтор после сбоя сети отправляет тот же. */
export function newRequestId(): string {
  return randomUUID();
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

interface HabitRow {
  id: string;
  title: string;
  category: HabitCategory;
  icon_key: string;
  color_key: HabitColor;
  revision: number;
  weekday_mask: number;
  reminder_times: string[] | null;
  goal_target: number;
  goal_unit: GoalUnit;
  time_of_day: TimeOfDay;
  frequency: Frequency;
  per_week: number | null;
  interval_days: number | null;
}

export async function fetchActiveHabits(): Promise<Habit[]> {
  const { data, error } = await client().rpc('list_active_habits');
  if (error) throw error;
  return ((data ?? []) as HabitRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    iconKey: row.icon_key,
    colorKey: row.color_key,
    revision: row.revision,
    weekdayMask: row.weekday_mask,
    // NOTE: PostgreSQL отдаёт время как «21:00:00» — в форме нужны часы и минуты.
    reminderTimes: (row.reminder_times ?? []).map((time) => time.slice(0, 5)),
    goalTarget: row.goal_target,
    goalUnit: row.goal_unit,
    timeOfDay: row.time_of_day,
    frequency: row.frequency,
    perWeek: row.per_week,
    intervalDays: row.interval_days,
  }));
}

function draftParams(habit: HabitDraft) {
  return {
    p_title: habit.title,
    p_category: habit.category,
    p_icon_key: habit.iconKey,
    p_color_key: habit.colorKey,
    p_weekday_mask: habit.weekdayMask,
    p_reminder_times: habit.reminderTimes,
    p_goal_target: habit.goalTarget,
    p_goal_unit: habit.goalUnit,
    p_time_of_day: habit.timeOfDay,
    p_frequency: habit.frequency,
    p_per_week: habit.frequency === 'weekly' ? habit.perWeek : null,
    p_interval_days: habit.frequency === 'interval' ? habit.intervalDays : null,
  };
}

export async function createHabit(habit: HabitDraft, requestId: string): Promise<void> {
  const { error } = await client().rpc('create_habit', {
    p_request_id: requestId,
    ...draftParams(habit),
  });
  if (error) throw error;
}

export async function updateHabit(
  habit: Habit,
  draft: HabitDraft,
  requestId: string,
): Promise<void> {
  const { error } = await client().rpc('update_habit', {
    p_request_id: requestId,
    p_habit_id: habit.id,
    p_expected_revision: habit.revision,
    ...draftParams(draft),
  });
  if (error) throw error;
}

export async function archiveHabit(habit: Habit, requestId: string): Promise<void> {
  const { error } = await client().rpc('archive_habit', {
    p_request_id: requestId,
    p_habit_id: habit.id,
    p_expected_revision: habit.revision,
  });
  if (error) throw error;
}

export async function fetchDisplayName(userId: string): Promise<string> {
  const { data, error } = await client()
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return (data as { display_name: string }).display_name;
}
