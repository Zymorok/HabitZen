import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { supabase } from '../supabase/client';
import { mobileLogger } from '../diagnostics/mobile-logger';
import { useAppPreferences } from '../providers/AppPreferencesProvider';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured';

interface AuthContext {
  readonly status: AuthStatus;
  readonly session: Session | null;
  signIn(email: string, password: string): Promise<void>;
  /** Возвращает true, если вход выполнен сразу; false — нужно подтвердить почту. */
  signUp(name: string, email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Сессия из ссылки восстановления пароля. */
  adoptRecoverySession(accessToken: string, refreshToken: string): Promise<void>;
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
    const { error } = await requireClient().auth.signInWithPassword({
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
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const client = requireClient();
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
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
        .update({
          display_name: name.trim().slice(0, 80) || undefined,
          time_zone: deviceTimeZone(),
          language_preference: preferences.language,
        })
        .eq('id', data.user.id);
      if (profileError) {
        // WARNING: Аккаунт уже создан; имя можно будет поправить позже, вход не отменяется.
        void mobileLogger.emit('warning', 'auth', 'auth.profile_update_failed', {
          code: profileError.code,
        });
      }
      void mobileLogger.emit('info', 'auth', 'auth.signed_up');
      return true;
    },
    [preferences.language],
  );

  const signOut = useCallback(async () => {
    const client = requireClient();
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

  const adoptRecoverySession = useCallback(async (accessToken: string, refreshToken: string) => {
    const { error } = await requireClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
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
      adoptRecoverySession,
    }),
    [
      status,
      session,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      adoptRecoverySession,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthContext {
  const value = useContext(Context);
  if (!value) throw new Error('Контекст входа не подключён.');
  return value;
}
