import { supabase } from '../../../core/supabase/client';
import type { DayOutcome } from '@habitzen/core/streaks';
import type { GoalUnit, TimeOfDay } from '../../habits/goal';

/**
 * План на день с сервера. Отметка, отмена и «Сегодня отдых» — команды с номером запроса
 * и ожидаемой версией: повтор не начисляет выполнение дважды.
 */
export type PlanStatus = 'pending' | 'completed' | 'skipped';

export interface PlanItem {
  readonly itemId: string;
  readonly habitId: string;
  readonly title: string;
  readonly iconKey: string;
  readonly colorKey: string;
  readonly status: PlanStatus;
  readonly revision: number;
  readonly localDate: string;
  /** Цель и сколько уже набрано: «3 из 8 стаканов». У «просто отметить» цель 1. */
  readonly target: number;
  readonly progress: number;
  readonly goalUnit: GoalUnit;
  readonly timeOfDay: TimeOfDay;
  /** «N раз в неделю»: сегодня по желанию, пока недельная цель не набрана. */
  readonly flexible: boolean;
  readonly weekDone: number;
  readonly perWeek: number | null;
}

export interface DayResult {
  readonly date: string;
  readonly outcome: DayOutcome;
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

interface PlanRow {
  item_id: string;
  habit_id: string;
  title: string;
  icon_key: string;
  color_key: string;
  status: PlanStatus;
  revision: number;
  local_date: string;
  target: number;
  progress: number;
  flexible: boolean;
  goal_unit: GoalUnit;
  time_of_day: TimeOfDay;
  week_done: number;
  per_week: number | null;
}

export async function openTodayPlan(): Promise<PlanItem[]> {
  // NOTE: POST-вызов: первый показ создаёт и фиксирует план на сегодня.
  const { data, error } = await client().rpc('open_today_plan');
  if (error) throw error;
  return ((data ?? []) as PlanRow[]).map((row) => ({
    itemId: row.item_id,
    habitId: row.habit_id,
    title: row.title,
    iconKey: row.icon_key,
    colorKey: row.color_key,
    status: row.status,
    revision: row.revision,
    localDate: row.local_date,
    target: row.target,
    progress: row.progress,
    goalUnit: row.goal_unit,
    timeOfDay: row.time_of_day,
    flexible: row.flexible,
    weekDone: row.week_done,
    perWeek: row.per_week,
  }));
}

export type PlanCommand = 'complete' | 'undo' | 'skip';
const COMMAND_RPC: Readonly<Record<PlanCommand, string>> = {
  complete: 'complete_plan_item',
  undo: 'undo_plan_item',
  skip: 'skip_plan_item',
};

export async function runPlanCommand(
  command: PlanCommand,
  item: PlanItem,
  requestId: string,
): Promise<void> {
  const { error } = await client().rpc(COMMAND_RPC[command], {
    p_request_id: requestId,
    p_item_id: item.itemId,
    p_expected_revision: item.revision,
  });
  if (error) throw error;
}

export interface ProgressResult {
  readonly revision: number;
  readonly status: PlanStatus;
  readonly progress: number;
}

/** «+1 стакан» или «−1»: сервер сам отмечает привычку, когда цель набрана. */
export async function addPlanProgress(
  item: PlanItem,
  delta: number,
  requestId: string,
): Promise<ProgressResult> {
  const { data, error } = await client().rpc('add_plan_progress', {
    p_request_id: requestId,
    p_item_id: item.itemId,
    p_expected_revision: item.revision,
    p_delta: delta,
  });
  if (error) throw error;
  return data as ProgressResult;
}

export async function fetchDayOutcomes(): Promise<DayResult[]> {
  const { data, error } = await client().rpc('day_outcomes', { p_days: 120 });
  if (error) throw error;
  return ((data ?? []) as { local_date: string; outcome: DayOutcome }[]).map((row) => ({
    date: row.local_date,
    outcome: row.outcome,
  }));
}
