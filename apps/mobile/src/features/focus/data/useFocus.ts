import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { useSaveSettings, useUserSettings } from '../../settings/data/useSettings';
import { fetchFocus, runFocusCommand } from './focus-api';
import type { FocusCommand, FocusSound } from './focus-api';

const focusKey = (userId: string | undefined) => ['focus', userId] as const;

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

/**
 * Звук фокуса с учётом общего выключателя «Звуки» в настройках (кадр 12).
 * NOTE: Если звуки выключены, фокус идёт в тишине, а кнопка показывает «Без звука».
 */
export function useFocusSound() {
  const settings = useUserSettings();
  const data: FocusSound | undefined = settings.data
    ? settings.data.soundsEnabled
      ? settings.data.focusSound
      : 'none'
    : undefined;
  return { ...settings, data };
}

/** Выбор звука в «Фокусе» означает «хочу слышать» — общий выключатель звуков включается. */
export function useSaveFocusSound() {
  const save = useSaveSettings();
  return {
    ...save,
    mutate: (sound: FocusSound) =>
      save.mutate(
        sound === 'none' ? { focusSound: sound } : { focusSound: sound, soundsEnabled: true },
      ),
  };
}
