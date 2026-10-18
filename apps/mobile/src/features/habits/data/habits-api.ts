import { randomUUID } from 'expo-crypto';
import { supabase } from '../../../core/supabase/client';
import type { HabitCategory, HabitColor } from '../../../shared/habit-look';

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
}

export interface HabitDraft {
  readonly title: string;
  readonly category: HabitCategory;
  readonly iconKey: string;
  readonly colorKey: HabitColor;
  readonly weekdayMask: number;
  readonly reminderTimes: readonly string[];
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
