import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { resetTo } from '../../../navigation/reset-to';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/auth/AuthProvider';
import { errorMessageKey } from '../../../core/supabase/errors';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { AuthLayout } from '../components/AuthLayout';
import { FormNotice } from '../components/FormNotice';
import { TextLink } from '../components/TextLink';
import { emailProblem } from '../validation';

/** Вход по почте и паролю («Уже есть аккаунт»). */
export function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'errors']);
  const { status, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (status === 'signedIn') return <Redirect href="/today" />;

  const submit = async () => {
    if (busy) return;
    const problem = emailProblem(email);
    setEmailError(problem ? t(`auth:${problem}`) : null);
    if (problem || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      resetTo(router, '/today');
    } catch (failure) {
      setError(
        t(status === 'unconfigured' ? 'auth:error_not_configured' : errorMessageKey(failure)),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      testID="sign-in-screen"
      title={t('auth:sign_in_title')}
      body={t('auth:sign_in_body')}
      footer={
        <TextLink
          label={t('auth:no_account')}
          testID="go-sign-up"
          onPress={() => router.replace('/auth/sign-up')}
        />
      }
    >
      <TextField
        label={t('auth:email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="sign-in-email"
      />
      <TextField
        label={t('auth:password')}
        value={password}
        onChangeText={setPassword}
        secure
        showLabel={t('auth:show_password')}
        hideLabel={t('auth:hide_password')}
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
        testID="sign-in-password"
      />
      <FormNotice message={error} tone="error" testID="sign-in-error" />
      <Button
        label={busy ? '…' : t('auth:sign_in')}
        onPress={() => void submit()}
        disabled={busy}
        testID="sign-in-submit"
      />
      <TextLink
        label={t('auth:forgot_password')}
        testID="go-forgot"
        onPress={() => router.push('/auth/forgot')}
      />
    </AuthLayout>
  );
}
