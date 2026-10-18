import { randomUUID } from 'expo-crypto';
import { supabase } from '../../../core/supabase/client';

/**
 * Контракт привычек с сервером. Запись — только через именованные команды (RPC):
 * сервер сам проверяет владельца, версию строки и повтор запроса.
 */
export type HabitCategory = 'water' | 'reading' | 'fitness' | 'meditation' | 'learning' | 'custom';
export type HabitColor = 'sage' | 'mint' | 'apricot' | 'sand' | 'blue' | 'rose';

export interface Habit {
  readonly id: string;
  readonly title: string;
  readonly category: HabitCategory;
  readonly iconKey: string;
  readonly colorKey: HabitColor;
  readonly revision: number;
  /** Биты 0–6 — понедельник…воскресенье. */
  readonly weekdayMask: number;
  readonly reminderTimes: readonly string[];
}

export interface NewHabit {
  readonly title: string;
  readonly category: HabitCategory;
  readonly weekdayMask: number;
}

/** Внешний вид по категории: значок и цвет подбираются автоматически. */
export const CATEGORY_LOOK: Readonly<Record<HabitCategory, { icon: string; color: HabitColor }>> = {
  water: { icon: 'drop', color: 'blue' },
  reading: { icon: 'book', color: 'sage' },
  fitness: { icon: 'walk', color: 'apricot' },
  meditation: { icon: 'leaf', color: 'mint' },
  learning: { icon: 'system', color: 'sand' },
  custom: { icon: 'sun', color: 'rose' },
};

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
    reminderTimes: row.reminder_times ?? [],
  }));
}

export async function createHabit(habit: NewHabit, requestId: string): Promise<void> {
  const look = CATEGORY_LOOK[habit.category];
  const { error } = await client().rpc('create_habit', {
    p_request_id: requestId,
    p_title: habit.title,
    p_category: habit.category,
    p_icon_key: look.icon,
    p_color_key: look.color,
    p_weekday_mask: habit.weekdayMask,
    p_reminder_times: [],
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
