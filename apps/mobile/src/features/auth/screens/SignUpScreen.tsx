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
import { emailProblem, passwordProblem } from '../validation';

/** Регистрация («Начать»): имя, почта, пароль. */
export function SignUpScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'errors']);
  const { status, signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email: string | null; password: string | null }>(
    {
      email: null,
      password: null,
    },
  );

  if (status === 'signedIn') return <Redirect href="/habits" />;

  const submit = async () => {
    if (busy) return;
    const emailIssue = emailProblem(email);
    const passwordIssue = passwordProblem(password);
    setFieldErrors({
      email: emailIssue ? t(`auth:${emailIssue}`) : null,
      password: passwordIssue ? t(`auth:${passwordIssue}`) : null,
    });
    if (emailIssue || passwordIssue) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const signedIn = await signUp(name, email, password);
      if (signedIn) resetTo(router, '/habits');
      // NOTE: Если на сервере включено подтверждение почты, сессии ещё нет — просим проверить почту.
      else setNotice(t('auth:check_email'));
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
      testID="sign-up-screen"
      title={t('auth:sign_up_title')}
      body={t('auth:sign_up_body')}
      footer={
        <TextLink
          label={t('auth:have_account')}
          testID="go-sign-in"
          onPress={() => router.replace('/auth/sign-in')}
        />
      }
    >
      <TextField
        label={t('auth:name')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        maxLength={80}
        testID="sign-up-name"
      />
      <TextField
        label={t('auth:email')}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="sign-up-email"
      />
      <TextField
        label={t('auth:password')}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        hint={t('auth:password_hint')}
        secure
        showLabel={t('auth:show_password')}
        hideLabel={t('auth:hide_password')}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        testID="sign-up-password"
      />
      <FormNotice message={error} tone="error" testID="sign-up-error" />
      <FormNotice message={notice} tone="success" testID="sign-up-notice" />
      <Button
        label={busy ? '…' : t('auth:sign_up')}
        onPress={() => void submit()}
        disabled={busy}
        testID="sign-up-submit"
      />
    </AuthLayout>
  );
}
