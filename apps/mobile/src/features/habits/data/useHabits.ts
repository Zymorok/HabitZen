import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import {
  archiveHabit,
  createHabit,
  fetchActiveHabits,
  fetchArchivedHabits,
  fetchDisplayName,
  reorderHabits,
  restoreHabit,
  updateHabit,
} from './habits-api';
import type { ArchivedHabit, Habit, HabitDraft } from './habits-api';

// NOTE: Ключ кеша включает пользователя: данные двух аккаунтов не смешиваются даже до очистки.
const habitsKey = (userId: string | undefined) => ['habits', userId] as const;
const archivedKey = (userId: string | undefined) => ['habits-archived', userId] as const;

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
        queryClient.invalidateQueries({ queryKey: archivedKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['today-plan', userId] }),
        queryClient.invalidateQueries({ queryKey: ['day-outcomes', userId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-days', userId] }),
        queryClient.invalidateQueries({ queryKey: ['habit-days', userId] }),
      ]),
  });
}

/** Архив (HZ-09): привычки, которые можно вернуть. */
export function useArchivedHabits() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: archivedKey(userId),
    queryFn: fetchArchivedHabits,
    enabled: Boolean(userId),
  });
}

/** Возврат из архива: привычка снова в списке и, если сегодня положена, в плане дня. */
export function useRestoreHabit() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({ habit, requestId }: { habit: ArchivedHabit; requestId: string }) =>
      restoreHabit(habit, requestId),
    onSuccess: () => {
      void mobileLogger.emit('info', 'habits', 'habits.restored');
    },
    onError: (error) => {
      void mobileLogger.emit('warning', 'habits', 'habits.restore_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: archivedKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['today-plan', userId] }),
        queryClient.invalidateQueries({ queryKey: ['day-outcomes', userId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-days', userId] }),
        queryClient.invalidateQueries({ queryKey: ['week-summary', userId] }),
      ]),
  });
}

/**
 * Новый порядок привычек. Список меняется сразу, сервер подтверждает;
 * при ошибке порядок возвращается к тому, что хранит сервер.
 */
export function useReorderHabits() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({ ids, requestId }: { ids: readonly string[]; requestId: string }) =>
      reorderHabits(ids, requestId),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: habitsKey(userId) });
      queryClient.setQueryData<Habit[]>(habitsKey(userId), (habits) =>
        habits
          ? ids.flatMap((id, index) => {
              const habit = habits.find((entry) => entry.id === id);
              return habit ? [{ ...habit, sortOrder: index + 1 }] : [];
            })
          : habits,
      );
    },
    onSuccess: () => {
      void mobileLogger.emit('info', 'habits', 'habits.reordered');
    },
    onError: (error) => {
      void mobileLogger.emit('warning', 'habits', 'habits.reorder_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['today-plan', userId] }),
        queryClient.invalidateQueries({ queryKey: ['week-summary', userId] }),
      ]),
  });
}
