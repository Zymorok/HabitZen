import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { isConflict } from '../../../core/supabase/errors';
import { archiveHabit, createHabit, fetchActiveHabits, fetchDisplayName } from './habits-api';
import type { Habit, NewHabit } from './habits-api';

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

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ habit, requestId }: { habit: NewHabit; requestId: string }) =>
      createHabit(habit, requestId),
    onSuccess: () => {
      void mobileLogger.emit('info', 'habits', 'habits.created');
      return queryClient.invalidateQueries({ queryKey: habitsKey(session?.user.id) });
    },
    onError: (error) => {
      void mobileLogger.emit('warning', 'habits', 'habits.create_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = habitsKey(session?.user.id);
  return useMutation({
    mutationFn: ({ habit, requestId }: { habit: Habit; requestId: string }) =>
      archiveHabit(habit, requestId),
    // NOTE: Привычка исчезает сразу; при ошибке список возвращается как был.
    onMutate: async ({ habit }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Habit[]>(key);
      queryClient.setQueryData<Habit[]>(key, (list) =>
        list?.filter((item) => item.id !== habit.id),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      void mobileLogger.emit('warning', 'habits', 'habits.archive_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
        conflict: isConflict(error),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
