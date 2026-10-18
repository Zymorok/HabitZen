import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import {
  archiveHabit,
  createHabit,
  fetchActiveHabits,
  fetchDisplayName,
  updateHabit,
} from './habits-api';
import type { Habit, HabitDraft } from './habits-api';

// NOTE: Ключ кеша включает пользователя: данные двух аккаунтов не смешиваются даже до очистки.
const habitsKey = (userId: string | undefined) => ['habits', userId] as const;

export function useActiveHabits() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: habitsKey(userId),
    queryFn: fetchActiveHabits,
    enabled: Boolean(userId),
  });
}

export function useDisplayName() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile-name', userId],
    queryFn: () => fetchDisplayName(userId!),
    enabled: Boolean(userId),
  });
}

/** Сохранение привычки: новая или изменение существующей. После успеха план дня перечитывается. */
export function useSaveHabit() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({
      draft,
      existing,
      requestId,
    }: {
      draft: HabitDraft;
      existing?: Habit;
      requestId: string;
    }) => (existing ? updateHabit(existing, draft, requestId) : createHabit(draft, requestId)),
    onSuccess: (_result, { existing }) => {
      void mobileLogger.emit('info', 'habits', existing ? 'habits.updated' : 'habits.created');
    },
    onError: (error) => {
      void mobileLogger.emit('warning', 'habits', 'habits.save_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['today-plan', userId] }),
        queryClient.invalidateQueries({ queryKey: ['day-outcomes', userId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-days', userId] }),
        queryClient.invalidateQueries({ queryKey: ['habit-days', userId] }),
      ]),
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({ habit, requestId }: { habit: Habit; requestId: string }) =>
      archiveHabit(habit, requestId),
    onError: (error) => {
      void mobileLogger.emit('warning', 'habits', 'habits.archive_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['today-plan', userId] }),
        queryClient.invalidateQueries({ queryKey: ['day-outcomes', userId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-days', userId] }),
        queryClient.invalidateQueries({ queryKey: ['habit-days', userId] }),
      ]),
  });
}
