import { supabase } from '../../../core/supabase/client';

/** Сад с сервера: рост дерева из выполнений и награды за полные дни (кадры 10–11). */
export interface GardenState {
  readonly completedTotal: number;
  readonly perfectDays: number;
  readonly rewardToday: boolean;
  readonly today: string;
}

export interface DayReward {
  /** true — награда выдана сейчас; false — уже была выдана раньше. */
  readonly granted: boolean;
  readonly completed: number;
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

export async function fetchGarden(): Promise<GardenState> {
  const { data, error } = await client().rpc('garden_state');
  if (error) throw error;
  const row = data as {
    completed_total: number;
    perfect_days: number;
    reward_today: boolean;
    today: string;
  };
  return {
    completedTotal: row.completed_total,
    perfectDays: row.perfect_days,
    rewardToday: row.reward_today,
    today: row.today,
  };
}

export async function claimDayReward(requestId: string): Promise<DayReward> {
  const { data, error } = await client().rpc('claim_day_reward', { p_request_id: requestId });
  if (error) throw error;
  const row = data as { granted: boolean; completed: number };
  return { granted: row.granted, completed: row.completed };
}
