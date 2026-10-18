export type TimerPhase = 'focus' | 'break';
export type TimerState =
  | { readonly status: 'idle'; readonly phase: TimerPhase; readonly remainingMs: number }
  | { readonly status: 'running'; readonly phase: TimerPhase; readonly deadlineMs: number }
  | { readonly status: 'paused'; readonly phase: TimerPhase; readonly remainingMs: number }
  | { readonly status: 'finished'; readonly phase: TimerPhase };

export const phaseDurationMs: Readonly<Record<TimerPhase, number>> = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000,
};

function assertInstant(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new RangeError('Недопустимое время.');
}

export function resetTimer(phase: TimerPhase): TimerState {
  return { status: 'idle', phase, remainingMs: phaseDurationMs[phase] };
}

export function remainingMs(state: TimerState, nowMs: number): number {
  assertInstant(nowMs);
  if (state.status === 'finished') return 0;
  if (state.status === 'running') return Math.max(0, state.deadlineMs - nowMs);
  return state.remainingMs;
}

export function startTimer(state: TimerState, nowMs: number): TimerState {
  assertInstant(nowMs);
  if (state.status === 'running' || state.status === 'finished') return state;
  return { status: 'running', phase: state.phase, deadlineMs: nowMs + state.remainingMs };
}

export function reconcileTimer(state: TimerState, nowMs: number): TimerState {
  // NOTE: Таймер восстанавливается по сроку завершения; число отрисованных кадров не является временем.
  if (state.status === 'running' && remainingMs(state, nowMs) === 0) {
    return { status: 'finished', phase: state.phase };
  }
  assertInstant(nowMs);
  return state;
}

export function pauseTimer(state: TimerState, nowMs: number): TimerState {
  if (state.status !== 'running') return state;
  const value = remainingMs(state, nowMs);
  return value === 0
    ? { status: 'finished', phase: state.phase }
    : { status: 'paused', phase: state.phase, remainingMs: value };
}

export function finishTimer(state: TimerState): TimerState {
  return { status: 'finished', phase: state.phase };
}
