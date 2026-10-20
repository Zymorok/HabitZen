import { supabase } from '../../../core/supabase/client';
import type { DayOutcome } from '@habitzen/core/streaks';
import type { GoalUnit } from '../../habits/goal';

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
  /** Сколько набрано из цели дня: «5 из 8 стаканов» (HZ-09). У «просто отметить» цель 1. */
  readonly progress: number;
  readonly target: number;
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
  return (
    (data ?? []) as {
      local_date: string;
      status: HabitDayStatus;
      progress: number | null;
      target: number | null;
    }[]
  ).map((row) => ({
    date: row.local_date,
    status: row.status,
    progress: row.progress ?? 0,
    target: row.target ?? 1,
  }));
}

/** Строка привычки в «Итогах недели» (HZ-08). */
export interface WeekHabit {
  readonly habitId: string;
  readonly title: string;
  readonly iconKey: string;
  readonly colorKey: string;
  readonly goalUnit: GoalUnit;
  readonly perWeek: number | null;
  readonly planned: number;
  readonly completed: number;
  /** Сколько набрано за неделю: 38 стаканов, 140 минут. */
  readonly progress: number;
}

export interface WeekSummary {
  readonly weekStart: string;
  readonly habits: readonly WeekHabit[];
  readonly focusMinutes: number;
}

interface WeekSummaryRow {
  week_start: string;
  focus_minutes: number;
  habits: {
    habit_id: string;
    title: string;
    icon_key: string;
    color_key: string;
    goal_unit: GoalUnit;
    per_week: number | null;
    planned: number;
    completed: number;
    progress: number;
  }[];
}

export async function fetchWeekSummary(weekStart: string): Promise<WeekSummary> {
  const { data, error } = await client().rpc('week_summary', { p_week_start: weekStart });
  if (error) throw error;
  const row = data as WeekSummaryRow;
  return {
    weekStart: row.week_start,
    focusMinutes: row.focus_minutes,
    habits: row.habits.map((habit) => ({
      habitId: habit.habit_id,
      title: habit.title,
      iconKey: habit.icon_key,
      colorKey: habit.color_key,
      goalUnit: habit.goal_unit,
      perWeek: habit.per_week,
      planned: habit.planned,
      completed: habit.completed,
      progress: habit.progress,
    })),
  };
}
