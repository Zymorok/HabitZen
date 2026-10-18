import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localDate } from '@habitzen/core/calendar';
import { summarizeStreaks } from '@habitzen/core/streaks';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { CALENDAR_KEY, HABIT_DAYS_KEY } from '../../progress/data/useProgress';
import { fetchDayOutcomes, openTodayPlan, runPlanCommand } from './plan-api';
import type { PlanCommand, PlanItem } from './plan-api';
export { planProgress } from '../progress';

const planKey = (userId: string | undefined) => ['today-plan', userId] as const;
const outcomesKey = (userId: string | undefined) => ['day-outcomes', userId] as const;

export function useTodayPlan() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({ queryKey: planKey(userId), queryFn: openTodayPlan, enabled: Boolean(userId) });
}

/** Серия «N дней подряд» по правилам ядра (packages/core/streaks). */
export function useStreak() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: outcomesKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const days = await fetchDayOutcomes();
      const last = days.at(-1);
      if (!last) return { current: 0, best: 0, today: null };
      // NOTE: Последний день ответа — «сегодня» в поясе профиля; календарь берёт его отсюда,
      // а не из часов телефона.
      try {
        return {
          ...summarizeStreaks(
            days.map((day) => ({ date: localDate(day.date), outcome: day.outcome })),
            localDate(last.date),
          ),
          today: last.date,
        };
      } catch {
        // WARNING: Неполная история не должна ломать экран: серия просто не показывается.
        void mobileLogger.emit('warning', 'progress', 'progress.streak_unavailable');
        return { current: 0, best: 0, today: last.date };
      }
    },
  });
}

/**
 * Команда над отметкой. Успех показывается только после ответа сервера —
 * до него строка остаётся в состоянии «Сохраняем…».
 */
export function usePlanCommand() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({
      command,
      item,
      requestId,
    }: {
      command: PlanCommand;
      item: PlanItem;
      requestId: string;
    }) => runPlanCommand(command, item, requestId),
    onSuccess: (_result, { command }) => {
      void mobileLogger.emit('info', 'habits', `habits.plan_${command}`);
    },
    onError: (error, { command }) => {
      void mobileLogger.emit('warning', 'habits', `habits.plan_${command}_failed`, {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planKey(userId) }),
        queryClient.invalidateQueries({ queryKey: outcomesKey(userId) }),
        // NOTE: Календарь и история привычки тоже показывают сегодняшнюю отметку.
        queryClient.invalidateQueries({ queryKey: [CALENDAR_KEY] }),
        queryClient.invalidateQueries({ queryKey: [HABIT_DAYS_KEY] }),
      ]);
    },
  });
}

/** После создания привычки план и серия перечитываются с сервера. */
export function useRefreshPlan() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: planKey(session?.user.id) }),
      queryClient.invalidateQueries({ queryKey: outcomesKey(session?.user.id) }),
      queryClient.invalidateQueries({ queryKey: [CALENDAR_KEY] }),
      queryClient.invalidateQueries({ queryKey: [HABIT_DAYS_KEY] }),
    ]);
}
