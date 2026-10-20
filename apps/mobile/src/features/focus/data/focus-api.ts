import { supabase } from '../../../core/supabase/client';
import type { TimerPhase, TimerState } from '@habitzen/core/timer';
import { resetTimer } from '@habitzen/core/timer';

/**
 * Таймер фокуса на сервере. В базе хранится срок окончания, поэтому таймер переживает
 * сворачивание, перезапуск и второе устройство. Команды — с номером запроса и версией.
 */
export type FocusStatus = 'running' | 'paused' | 'completed' | 'ended_early' | 'reset';
import type { FocusSound } from '../../settings/data/settings-api';
export type { FocusSound } from '../../settings/data/settings-api';
export const FOCUS_SOUNDS: readonly FocusSound[] = ['none', 'rain', 'forest', 'white_noise'];

export interface FocusSession {
  readonly id: string;
  readonly phase: TimerPhase;
  readonly status: FocusStatus;
  readonly revision: number;
  /** Привычка, в которую засчитается занятие (HZ-08), или null. */
  readonly habitId: string | null;
  readonly remainingMs: number | null;
  /** Срок окончания уже в часах телефона (с поправкой на расхождение с сервером). */
  readonly deadlineMs: number | null;
}

export interface FocusSnapshot {
  readonly session: FocusSession | null;
  readonly nextPhase: TimerPhase;
  readonly completedToday: number;
  readonly minutesToday: number;
}

interface SessionRow {
  id: string;
  phase: TimerPhase;
  status: FocusStatus;
  revision: number;
  habit_id: string | null;
  remaining_ms: number | null;
  deadline_at: string | null;
}

function client() {
  if (!supabase) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  return supabase;
}

/** Разница «часы сервера − часы телефона»; срок переводится в часы телефона. */
export function toSession(row: SessionRow, clockOffsetMs: number): FocusSession {
  return {
    id: row.id,
    phase: row.phase,
    status: row.status,
    revision: row.revision,
    habitId: row.habit_id ?? null,
    remainingMs: row.remaining_ms,
    deadlineMs: row.deadline_at ? Date.parse(row.deadline_at) - clockOffsetMs : null,
  };
}

/** Состояние ядра таймера для экрана: идёт, на паузе или ждёт запуска следующей фазы. */
export function timerStateOf(snapshot: FocusSnapshot): TimerState {
  const session = snapshot.session;
  if (session?.status === 'running' && session.deadlineMs !== null)
    return { status: 'running', phase: session.phase, deadlineMs: session.deadlineMs };
  if (session?.status === 'paused' && session.remainingMs !== null)
    return { status: 'paused', phase: session.phase, remainingMs: session.remainingMs };
  return resetTimer(snapshot.nextPhase);
}

export async function fetchFocus(): Promise<FocusSnapshot> {
  const askedAt = Date.now();
  const { data, error } = await client().rpc('current_focus');
  if (error) throw error;
  const answeredAt = Date.now();
  const row = data as {
    session: SessionRow | null;
    next_phase: TimerPhase;
    completed_today: number;
    minutes_today: number;
    server_now: string;
  };
  // NOTE: Время сервера относим к середине запроса — так задержка сети почти не влияет.
  const offset = Date.parse(row.server_now) - (askedAt + answeredAt) / 2;
  return {
    session: row.session ? toSession(row.session, offset) : null,
    nextPhase: row.next_phase,
    completedToday: row.completed_today,
    minutesToday: row.minutes_today,
  };
}

export type FocusCommand =
  | { readonly kind: 'start'; readonly phase: TimerPhase; readonly habitId?: string | null }
  | { readonly kind: 'skip_break' }
  | {
      readonly kind: 'pause' | 'resume' | 'finish' | 'reset';
      readonly session: FocusSession;
    };

const SESSION_RPC = {
  pause: 'pause_focus',
  resume: 'resume_focus',
  finish: 'finish_focus',
  reset: 'reset_focus',
} as const;

export async function runFocusCommand(command: FocusCommand, requestId: string): Promise<void> {
  const rpc = client().rpc.bind(client());
  const { error } =
    command.kind === 'start'
      ? await rpc('start_focus', {
          p_request_id: requestId,
          p_phase: command.phase,
          // NOTE: Перерыв ни во что не засчитывается — привычка только у фокуса.
          p_habit_id: command.phase === 'focus' ? (command.habitId ?? null) : null,
        })
      : command.kind === 'skip_break'
        ? await rpc('skip_break', { p_request_id: requestId })
        : await rpc(SESSION_RPC[command.kind], {
            p_request_id: requestId,
            p_session_id: command.session.id,
            p_expected_revision: command.session.revision,
          });
  if (error) throw error;
}
