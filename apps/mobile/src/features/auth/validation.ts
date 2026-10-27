/**
 * Проверки формы до отправки на сервер. Окончательно правила проверяет сервер,
 * здесь — только чтобы человек сразу увидел, что поправить.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function emailProblem(email: string): 'email_required' | 'error_invalid_email' | null {
  const value = email.trim();
  if (!value) return 'email_required';
  // NOTE: Простая проверка формы адреса; существование ящика проверяет письмо.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'error_invalid_email';
  return null;
}

export function passwordProblem(password: string): 'password_short' | null {
  return password.length < MIN_PASSWORD_LENGTH ? 'password_short' : null;
}

/** Что принесла ссылка из письма: сессию (подтверждение почты или новый пароль) или ничего. */
export type AuthLink =
  | {
      readonly kind: 'session';
      /** true — письмо «Забыли пароль?», false — подтверждение почты при регистрации. */
      readonly recovery: boolean;
      readonly accessToken: string;
      readonly refreshToken: string;
    }
  | { readonly kind: 'invalid' };

/** Разбирает ссылку из письма Supabase (параметры после «#» или «?»). */
export function authLink(url: string): AuthLink {
  const tail = url.includes('#')
    ? url.slice(url.indexOf('#') + 1)
    : url.slice(url.indexOf('?') + 1);
  const params = new URLSearchParams(tail);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  // NOTE: Устаревшая или повторная ссылка приходит с error=… вместо токенов.
  if (!accessToken || !refreshToken) return { kind: 'invalid' };
  return {
    kind: 'session',
    recovery: params.get('type') === 'recovery',
    accessToken,
    refreshToken,
  };
}
