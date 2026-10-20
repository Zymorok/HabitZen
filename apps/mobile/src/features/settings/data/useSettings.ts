import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { fetchSettings, saveDisplayName, saveSettings } from './settings-api';
import type { UserSettings } from './settings-api';

const settingsKey = (userId: string | undefined) => ['user-settings', userId] as const;

export function useUserSettings() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: settingsKey(userId),
    queryFn: fetchSettings,
    enabled: Boolean(userId),
  });
}

/**
 * Изменение настроек видно сразу; если сервер не принял — возвращается прежнее значение.
 * NOTE: Переключатели не ждут сети: человек видит отклик в момент касания.
 */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => {
      if (!userId) throw new Error('not_authenticated');
      return saveSettings(userId, patch);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey(userId) });
      const previous = queryClient.getQueryData<UserSettings>(settingsKey(userId));
      if (previous) queryClient.setQueryData(settingsKey(userId), { ...previous, ...patch });
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey(userId), context.previous);
      void mobileLogger.emit('warning', 'data', 'settings.save_failed', {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKey(userId) }),
  });
}

export function useSaveDisplayName() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (name: string) => {
      if (!userId) throw new Error('not_authenticated');
      return saveDisplayName(userId, name);
    },
    onSuccess: (_result, name) => queryClient.setQueryData(['profile-name', userId], name),
    onError: () => void mobileLogger.emit('warning', 'data', 'profile.name_save_failed'),
  });
}
