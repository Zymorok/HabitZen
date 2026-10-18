import { useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/auth/AuthProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { AuthLayout } from '../components/AuthLayout';
import { FormNotice } from '../components/FormNotice';
import { emailProblem } from '../validation';

/** Куда вернуть человека из письма: в браузере — на этот же сайт, на телефоне — в приложение. */
function recoveryRedirect(): string {
  if (Platform.OS === 'web') return `${globalThis.location.origin}/auth/callback`;
  return Linking.createURL('/auth/callback');
}

/** Восстановление пароля: письмо со ссылкой на экран нового пароля. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation(['auth', 'errors']);
  const { status, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const problem = emailProblem(email);
    setEmailError(problem ? t(`auth:${problem}`) : null);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email, recoveryRedirect());
      // NOTE: Ответ одинаковый для любой почты: нельзя узнать, есть ли такой аккаунт.
      setSent(true);
    } catch (failure) {
      setError(
        t(status === 'unconfigured' ? 'auth:error_not_configured' : errorMessageKey(failure)),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout testID="forgot-screen" title={t('auth:reset_title')} body={t('auth:reset_body')}>
      <TextField
        label={t('auth:email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={() => void submit()}
        testID="forgot-email"
      />
      <FormNotice message={error} tone="error" testID="forgot-error" />
      <FormNotice
        message={sent ? t('auth:reset_sent') : null}
        tone="success"
        testID="forgot-sent"
      />
      <Button
        label={busy ? '…' : t('auth:reset_send')}
        onPress={() => void submit()}
        disabled={busy}
        testID="forgot-submit"
      />
    </AuthLayout>
  );
}
