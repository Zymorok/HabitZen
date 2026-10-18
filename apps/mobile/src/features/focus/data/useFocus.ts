import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { fetchFocus, fetchFocusSound, runFocusCommand, saveFocusSound } from './focus-api';
import type { FocusCommand, FocusSound } from './focus-api';

const focusKey = (userId: string | undefined) => ['focus', userId] as const;
const soundKey = (userId: string | undefined) => ['focus-sound', userId] as const;

export function useFocusState() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({ queryKey: focusKey(userId), queryFn: fetchFocus, enabled: Boolean(userId) });
}

/**
 * Команда таймера. Экран меняется только после ответа сервера и перечитывания состояния:
 * так пауза на одном устройстве не расходится с другим.
 */
export function useFocusCommand() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({ command, requestId }: { command: FocusCommand; requestId: string }) =>
      runFocusCommand(command, requestId),
    onSuccess: (_result, { command }) => {
      void mobileLogger.emit('info', 'focus', `focus.${command.kind}`);
    },
    onError: (error, { command }) => {
      void mobileLogger.emit('warning', 'focus', `focus.${command.kind}_failed`, {
        code: (error as { code?: string }).code ?? 'unknown',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: focusKey(userId) }),
  });
}

export function useFocusSound() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: soundKey(userId),
    queryFn: fetchFocusSound,
    enabled: Boolean(userId),
  });
}

/** Выбор звука виден сразу; если сохранить не удалось — возвращается прежний. */
export function useSaveFocusSound() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (sound: FocusSound) => {
      if (!userId) throw new Error('not_authenticated');
      return saveFocusSound(userId, sound);
    },
    onMutate: async (sound) => {
      await queryClient.cancelQueries({ queryKey: soundKey(userId) });
      const previous = queryClient.getQueryData<FocusSound>(soundKey(userId));
      queryClient.setQueryData(soundKey(userId), sound);
      return { previous };
    },
    onError: (_error, _sound, context) => {
      queryClient.setQueryData(soundKey(userId), context?.previous ?? 'none');
      void mobileLogger.emit('warning', 'focus', 'focus.sound_save_failed');
    },
  });
}
