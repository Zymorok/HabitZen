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

/** Достаёт токены из ссылки восстановления пароля (после «#» или «?»). */
export function recoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  const tail = url.includes('#')
    ? url.slice(url.indexOf('#') + 1)
    : url.slice(url.indexOf('?') + 1);
  const params = new URLSearchParams(tail);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}
