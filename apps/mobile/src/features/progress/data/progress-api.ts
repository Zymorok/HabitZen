import { supabase } from '../../../core/supabase/client';
import type { DayOutcome } from '@habitzen/core/streaks';

/** Календарь (кадр 08) и история одной привычки (кадр 09) с сервера. */
export interface CalendarDay {
  readonly date: string;
  readonly planned: number;
  readonly completed: number;
  readonly skipped: number;
  readonly outcome: DayOutcome;
}

export type HabitDayStatus = 'completed' | 'skipped' | 'missed' | 'pending' | 'rest';
export interface HabitDay {
  readonly date: string;
  readonly status: HabitDayStatus;
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

interface CalendarRow {
  local_date: string;
  planned: number;
  completed: number;
  skipped: number;
  outcome: DayOutcome;
}

export async function fetchCalendarDays(from: string, to: string): Promise<CalendarDay[]> {
  const { data, error } = await client().rpc('calendar_days', { p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as CalendarRow[]).map((row) => ({
    date: row.local_date,
    planned: row.planned,
    completed: row.completed,
    skipped: row.skipped,
    outcome: row.outcome,
  }));
}

export async function fetchHabitDays(habitId: string, days: number): Promise<HabitDay[]> {
  const { data, error } = await client().rpc('habit_days', { p_habit_id: habitId, p_days: days });
  if (error) throw error;
  return ((data ?? []) as { local_date: string; status: HabitDayStatus }[]).map((row) => ({
    date: row.local_date,
    status: row.status,
  }));
}
