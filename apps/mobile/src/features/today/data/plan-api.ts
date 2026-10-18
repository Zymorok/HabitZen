import { supabase } from '../../../core/supabase/client';
import type { DayOutcome } from '@habitzen/core/streaks';

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

export async function fetchDayOutcomes(): Promise<DayResult[]> {
  const { data, error } = await client().rpc('day_outcomes', { p_days: 120 });
  if (error) throw error;
  return ((data ?? []) as { local_date: string; outcome: DayOutcome }[]).map((row) => ({
    date: row.local_date,
    outcome: row.outcome,
  }));
}
