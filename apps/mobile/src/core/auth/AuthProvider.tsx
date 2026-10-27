import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { supabase } from '../supabase/client';
import { cancelAllReminders } from '../../platform/notifications/reminders';
import { mobileLogger } from '../diagnostics/mobile-logger';
import { useAppPreferences } from '../providers/AppPreferencesProvider';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured';

interface AuthContext {
  readonly status: AuthStatus;
  readonly session: Session | null;
  signIn(email: string, password: string): Promise<void>;
  /**
   * Возвращает true, если вход выполнен сразу; false — нужно подтвердить почту.
   * redirectTo — куда ведёт ссылка из письма подтверждения.
   */
  signUp(name: string, email: string, password: string, redirectTo: string): Promise<boolean>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Сессия из ссылки письма: подтверждение почты или восстановление пароля. */
  adoptLinkSession(accessToken: string, refreshToken: string): Promise<void>;
}

const Context = createContext<AuthContext | null>(null);

function deviceTimeZone(): string {
  // NOTE: Часовой пояс устройства, а не язык: язык не определяет пояс (см. docs/architecture.md).
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

function requireClient() {
  if (!supabase) {
    // NOTE: Экран переводит этот код в сообщение «сервер не настроен».
    throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  }
  return supabase;
}

/** Ключ в данных аккаунта: профиль, который ещё не перенесён (HZ-11, облако). */
const PENDING_PROFILE = 'pending_profile';

/**
 * Первый вход после подтверждения почты: имя, пояс и язык из регистрации переносятся в профиль,
 * затем отметка в данных аккаунта снимается. Ошибка не мешает входу — профиль можно поправить.
 */
async function applyPendingProfile(user: User): Promise<void> {
  const pending = user.user_metadata?.[PENDING_PROFILE] as
    { display_name?: string; time_zone?: string; language_preference?: string } | null | undefined;
  if (!pending) return;
  const client = requireClient();
  const { error } = await client.from('profiles').update(pending).eq('id', user.id);
  if (error) {
    void mobileLogger.emit('warning', 'auth', 'auth.profile_update_failed', { code: error.code });
    return;
  }
  await client.auth.updateUser({ data: { [PENDING_PROFILE]: null } });
  void mobileLogger.emit('info', 'auth', 'auth.pending_profile_applied');
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const { preferences } = useAppPreferences();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      // NOTE: Данные прошлого аккаунта не должны мелькнуть у следующего.
      if (!next) queryClient.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await requireClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      void mobileLogger.emit('warning', 'auth', 'auth.sign_in_failed', {
        code: error.code ?? 'unknown',
      });
      throw error;
    }
    void mobileLogger.emit('info', 'auth', 'auth.signed_in');
    if (data.user) await applyPendingProfile(data.user);
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string, redirectTo: string) => {
      const client = requireClient();
      const profile = {
        display_name: name.trim().slice(0, 80) || undefined,
        time_zone: deviceTimeZone(),
        language_preference: preferences.language,
      };
      // NOTE: С подтверждением почты (облачный Supabase) сессии сразу нет и профиль не обновить.
      // Имя, пояс и язык ждут в данных аккаунта и переносятся в профиль при первом входе.
      // FIXME(HZ-11): Без emailRedirectTo ссылка из письма вела на адрес сайта из панели Supabase,
      // а не обратно в приложение.
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { [PENDING_PROFILE]: profile }, emailRedirectTo: redirectTo },
      });
      if (error) {
        void mobileLogger.emit('warning', 'auth', 'auth.sign_up_failed', {
          code: error.code ?? 'unknown',
        });
        throw error;
      }
      if (!data.session || !data.user) return false;
      // NOTE: Профиль создаёт сервер. Клиент лишь заполняет разрешённые поля: имя, пояс, язык.
      const { error: profileError } = await client
        .from('profiles')
        .update(profile)
        .eq('id', data.user.id);
      if (profileError) {
        // WARNING: Аккаунт уже создан; имя можно будет поправить позже, вход не отменяется.
        void mobileLogger.emit('warning', 'auth', 'auth.profile_update_failed', {
          code: profileError.code,
        });
      } else {
        // NOTE: Профиль уже заполнен — отложенная копия не должна перезаписать его при входе.
        await client.auth.updateUser({ data: { [PENDING_PROFILE]: null } });
      }
      void mobileLogger.emit('info', 'auth', 'auth.signed_up');
      return true;
    },
    [preferences.language],
  );

  const signOut = useCallback(async () => {
    const client = requireClient();
    // NOTE: Напоминания этого аккаунта не должны приходить после выхода.
    await cancelAllReminders();
    // NOTE: Выход только на этом устройстве; другие устройства остаются в аккаунте.
    await client.auth.signOut({ scope: 'local' });
    queryClient.clear();
    void mobileLogger.emit('info', 'auth', 'auth.signed_out');
  }, [queryClient]);

  const requestPasswordReset = useCallback(async (email: string, redirectTo: string) => {
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) throw error;
    void mobileLogger.emit('info', 'auth', 'auth.reset_requested');
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireClient().auth.updateUser({ password });
    if (error) throw error;
    void mobileLogger.emit('info', 'auth', 'auth.password_updated');
  }, []);

  const adoptLinkSession = useCallback(async (accessToken: string, refreshToken: string) => {
    const { data, error } = await requireClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    // NOTE: Подтверждение почты — первый вход: имя, пояс и язык из регистрации ждут здесь.
    if (data.user) await applyPendingProfile(data.user);
    void mobileLogger.emit('info', 'auth', 'auth.link_session_adopted');
  }, []);

  const value = useMemo(
    () => ({
      status,
      session,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      adoptLinkSession,
    }),
    [
      status,
      session,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      adoptLinkSession,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthContext {
  const value = useContext(Context);
  if (!value) throw new Error('Контекст входа не подключён.');
  return value;
}
