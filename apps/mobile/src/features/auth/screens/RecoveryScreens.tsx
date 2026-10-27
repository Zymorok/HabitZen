import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { resetTo } from '../../../navigation/reset-to';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/auth/AuthProvider';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { AuthLayout } from '../components/AuthLayout';
import { FormNotice } from '../components/FormNotice';
import { TextLink } from '../components/TextLink';
import { authLink, passwordProblem } from '../validation';
import type { AuthLink } from '../validation';

/**
 * Возврат из письма: подтверждение почты при регистрации или восстановление пароля.
 * Ссылка несёт сессию — экран принимает её и ведёт в план дня или к форме нового пароля.
 */
export function AuthCallbackScreen() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { theme } = useAppPreferences();
  const { status, adoptLinkSession } = useAuth();
  // FIXME(HZ-11): Раньше здесь был useURL: если приложение уже было открыто, ссылка приходила
  // до появления экрана, он её не видел и крутил загрузку вечно. useLinkingURL сразу знает
  // последнюю ссылку — и при холодном запуске, и при возврате из почты.
  const nativeUrl = Linking.useLinkingURL();
  // NOTE: В браузере адрес запоминается один раз: ниже токены из него стираются.
  const [webUrl] = useState(() => (Platform.OS === 'web' ? globalThis.location.href : null));
  const url = webUrl ?? nativeUrl;
  const link = useMemo<AuthLink>(() => (url ? authLink(url) : { kind: 'invalid' }), [url]);
  const [failed, setFailed] = useState(false);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (link.kind !== 'session' || handled.current === link.accessToken) return;
    handled.current = link.accessToken;
    // WARNING: Токены сразу убираются из адресной строки браузера, чтобы не остались в истории.
    if (Platform.OS === 'web') globalThis.history.replaceState(null, '', '/auth/callback');
    adoptLinkSession(link.accessToken, link.refreshToken)
      .then(() =>
        link.recovery ? router.replace('/auth/new-password') : resetTo(router, '/today'),
      )
      .catch(() => setFailed(true));
  }, [link, adoptLinkSession, router]);

  const broken = failed || link.kind === 'invalid';
  const recovery = link.kind === 'session' && link.recovery;
  const title = broken ? t('link_title') : recovery ? t('reset_title') : t('confirm_title');
  const body = broken ? t('link_invalid') : recovery ? t('link_checking') : t('confirm_checking');

  // NOTE: Старая ссылка у того, кто уже вошёл, не пугает ошибкой — просто ведёт в план дня.
  if (broken && status === 'signedIn') return <Redirect href="/today" />;

  return (
    <AuthLayout
      testID="auth-callback"
      title={title}
      body={body}
      footer={
        broken ? (
          <>
            <TextLink
              label={t('sign_in')}
              testID="link-sign-in"
              onPress={() => router.replace('/auth/sign-in')}
            />
            <TextLink
              label={t('forgot_password')}
              testID="recovery-retry"
              onPress={() => router.replace('/auth/forgot')}
            />
          </>
        ) : null
      }
    >
      {broken ? null : (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      )}
    </AuthLayout>
  );
}

/** Новый пароль после перехода по ссылке из письма. */
export function NewPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'errors']);
  const { status, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (status === 'signedOut') return <Redirect href="/auth/forgot" />;

  const submit = async () => {
    if (busy) return;
    const problem = passwordProblem(password);
    setFieldError(problem ? t(`auth:${problem}`) : null);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      resetTo(router, '/today');
    } catch (failure) {
      setError(t(errorMessageKey(failure)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      testID="new-password-screen"
      title={t('auth:new_password_title')}
      body={t('auth:new_password_body')}
    >
      <TextField
        label={t('auth:password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError}
        hint={t('auth:password_hint')}
        secure
        showLabel={t('auth:show_password')}
        hideLabel={t('auth:hide_password')}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        testID="new-password"
      />
      <FormNotice message={error} tone="error" testID="new-password-error" />
      <Button
        label={busy ? '…' : t('auth:new_password_save')}
        onPress={() => void submit()}
        disabled={busy}
        testID="new-password-submit"
      />
    </AuthLayout>
  );
}
