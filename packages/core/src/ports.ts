import type { LocalDate } from './calendar.ts';

export interface Clock {
  now(): Date;
}
export interface MutationContext {
  readonly requestId: string;
  readonly expectedRevision: number;
}
export interface RecordHabitOutcome {
  readonly dailyPlanItemId: string;
  readonly outcome: 'completed' | 'skipped' | 'pending';
  readonly context: MutationContext;
}
export interface HabitMutationResult {
  readonly itemId: string;
  readonly revision: number;
  readonly status: 'completed' | 'skipped' | 'pending';
  readonly localDate: LocalDate;
}
export interface HabitJournal {
  recordOutcome(command: RecordHabitOutcome): Promise<HabitMutationResult>;
}
// TODO(HZ-03): Реализовать адаптер Supabase после транзакционных функций и проверок двух аккаунтов.
