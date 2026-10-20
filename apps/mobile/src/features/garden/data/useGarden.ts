import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gardenLevel } from '@habitzen/core/garden';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { claimDayReward, fetchGarden } from './garden-api';

/** Ключ кэша сада; команды плана сбрасывают его, чтобы дерево росло сразу после отметки. */
export const GARDEN_KEY = 'garden';

export function useGarden() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: [GARDEN_KEY, userId],
    queryFn: fetchGarden,
    enabled: Boolean(userId),
    select: (state) => ({ ...state, ...gardenLevel(state.completedTotal) }),
  });
}

/** Награда за полный день: сервер сам проверяет план и выдаёт её один раз. */
export function useClaimDayReward() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (requestId: string) => claimDayReward(requestId),
    onSuccess: (reward) => {
      void mobileLogger.emit('info', 'progress', 'garden.day_reward', {
        status: reward.granted ? 'granted' : 'repeat',
      });
    },
    onError: (error) => {
      void mobileLogger.emit('warning', 'progress', 'garden.day_reward_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [GARDEN_KEY, userId] }),
  });
}
