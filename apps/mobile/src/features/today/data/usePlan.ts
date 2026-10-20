import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localDate } from '@habitzen/core/calendar';
import { FREEZE_EVERY, summarizeWithFreezes } from '@habitzen/core/streaks';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { GARDEN_KEY } from '../../garden/data/useGarden';
import { CALENDAR_KEY, HABIT_DAYS_KEY, WEEK_SUMMARY_KEY } from '../../progress/data/useProgress';
import { newRequestId } from '../../habits/data/habits-api';
import { addPlanProgress, fetchDayOutcomes, openTodayPlan, runPlanCommand } from './plan-api';
import type { PlanCommand, PlanItem } from './plan-api';
import { applyProgress } from '../progress';
export { planProgress } from '../progress';

const planKey = (userId: string | undefined) => ['today-plan', userId] as const;
const outcomesKey = (userId: string | undefined) => ['day-outcomes', userId] as const;

export function useTodayPlan() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({ queryKey: planKey(userId), queryFn: openTodayPlan, enabled: Boolean(userId) });
}

/**
 * Серия «N дней подряд» по правилам ядра (packages/core/streaks) — с заморозками (HZ-08).
 * NOTE: Запас заморозок считается по тем же 120 дням истории, что и серия.
 */
export function useStreak() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: outcomesKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const days = await fetchDayOutcomes();
      const last = days.at(-1);
      const empty = { current: 0, best: 0, freezes: 0, nextFreezeIn: FREEZE_EVERY, frozen: [] };
      if (!last) return { ...empty, today: null };
      // NOTE: Последний день ответа — «сегодня» в поясе профиля; календарь берёт его отсюда,
      // а не из часов телефона.
      try {
        return {
          ...summarizeWithFreezes(
            days.map((day) => ({ date: localDate(day.date), outcome: day.outcome })),
            localDate(last.date),
          ),
          today: last.date,
        };
      } catch {
        // WARNING: Неполная история не должна ломать экран: серия просто не показывается.
        void mobileLogger.emit('warning', 'progress', 'progress.streak_unavailable');
        return { ...empty, today: last.date };
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
        queryClient.invalidateQueries({ queryKey: [WEEK_SUMMARY_KEY] }),
        // NOTE: Дерево растёт от каждой отметки и уменьшается от отмены.
        queryClient.invalidateQueries({ queryKey: [GARDEN_KEY] }),
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
      queryClient.invalidateQueries({ queryKey: [WEEK_SUMMARY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [GARDEN_KEY] }),
    ]);
}

interface ProgressQueue {
  /** Нажатия, ещё не отправленные на сервер. */
  pending: number;
  running: boolean;
  /** Состояние, которое сервер подтвердил последним, — чтобы заметить «цель набрана». */
  confirmed: PlanItem['status'];
  onCompleted?: (() => void) | undefined;
}
// NOTE: Очередь общая для всех экранов: «+» в плане и на экране привычки не спорят о версии.
const progressQueues = new Map<string, ProgressQueue>();

/**
 * «+1» и «−1» для привычек с количеством. Строка меняется сразу, а нажатия уходят на сервер
 * по одному запросу за раз: пока ждём ответ, новые нажатия копятся и уйдут одним числом.
 * PERF: Пять быстрых нажатий — это один-два запроса, а не пять конфликтов версий.
 */
export function usePlanProgress() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = planKey(session?.user.id);
  const [error, setError] = useState<unknown>(null);
  const find = (itemId: string) =>
    queryClient.getQueryData<PlanItem[]>(key)?.find((entry) => entry.itemId === itemId);
  const patch = (itemId: string, change: (item: PlanItem) => PlanItem) =>
    queryClient.setQueryData<PlanItem[]>(key, (items) =>
      items?.map((entry) => (entry.itemId === itemId ? change(entry) : entry)),
    );

  const flush = async (itemId: string): Promise<void> => {
    const queue = progressQueues.get(itemId);
    const item = find(itemId);
    if (!queue || queue.running || queue.pending === 0 || !item) return;
    const delta = queue.pending;
    queue.pending = 0;
    queue.running = true;
    try {
      const result = await addPlanProgress(item, delta, newRequestId());
      // NOTE: Ответ сервера главный, но нажатия, сделанные за время запроса, не теряются.
      patch(itemId, (current) => {
        const confirmed: PlanItem = {
          ...current,
          revision: result.revision,
          status: result.status,
          progress: result.progress,
        };
        return queue.pending ? applyProgress(confirmed, queue.pending) : confirmed;
      });
      const reached = result.status === 'completed' && queue.confirmed !== 'completed';
      queue.confirmed = result.status;
      if (reached && queue.pending === 0) queue.onCompleted?.();
      void mobileLogger.emit('info', 'habits', 'habits.plan_progress');
    } catch (failure) {
      queue.pending = 0;
      setError(failure);
      void mobileLogger.emit('warning', 'habits', 'habits.plan_progress_failed', {
        code: (failure as { code?: string }).code ?? 'unknown',
      });
      await queryClient.invalidateQueries({ queryKey: key });
    } finally {
      queue.running = false;
    }
    if (queue.pending !== 0) return flush(itemId);
    progressQueues.delete(itemId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: outcomesKey(session?.user.id) }),
      queryClient.invalidateQueries({ queryKey: [CALENDAR_KEY] }),
      queryClient.invalidateQueries({ queryKey: [HABIT_DAYS_KEY] }),
      queryClient.invalidateQueries({ queryKey: [WEEK_SUMMARY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [GARDEN_KEY] }),
    ]);
  };

  /** onCompleted — когда сервер подтвердил, что цель на сегодня набрана. */
  const add = (item: PlanItem, delta: number, onCompleted?: () => void) => {
    const current = find(item.itemId) ?? item;
    const next = applyProgress(current, delta);
    if (next.progress === current.progress) return;
    setError(null);
    const queue = progressQueues.get(item.itemId) ?? {
      pending: 0,
      running: false,
      confirmed: current.status,
    };
    queue.pending += next.progress - current.progress;
    queue.onCompleted = onCompleted;
    progressQueues.set(item.itemId, queue);
    patch(item.itemId, () => next);
    void flush(item.itemId);
  };

  return { add, error };
}
