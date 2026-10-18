import { useEffect, useState } from 'react';
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
import { passwordProblem, recoveryTokens } from '../validation';

/**
 * Возврат из письма восстановления. Ссылка несёт временную сессию —
 * экран принимает её и ведёт к форме нового пароля.
 */
export function RecoveryCallbackScreen() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { theme } = useAppPreferences();
  const { adoptRecoverySession } = useAuth();
  const nativeUrl = Linking.useURL();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = Platform.OS === 'web' ? globalThis.location.href : nativeUrl;
    if (!url) return;
    const tokens = recoveryTokens(url);
    if (!tokens) {
      setFailed(true);
      return;
    }
    // WARNING: Токены сразу убираются из адресной строки браузера, чтобы не остались в истории.
    if (Platform.OS === 'web') globalThis.history.replaceState(null, '', '/auth/callback');
    adoptRecoverySession(tokens.accessToken, tokens.refreshToken)
      .then(() => router.replace('/auth/new-password'))
      .catch(() => setFailed(true));
  }, [nativeUrl, adoptRecoverySession, router]);

  return (
    <AuthLayout
      testID="recovery-callback"
      title={t('reset_title')}
      body={failed ? t('link_invalid') : t('link_checking')}
      footer={
        failed ? (
          <TextLink
            label={t('reset_send')}
            testID="recovery-retry"
            onPress={() => router.replace('/auth/forgot')}
          />
        ) : null
      }
    >
      {failed ? null : (
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
