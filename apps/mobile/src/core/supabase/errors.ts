/**
 * Перевод ошибок сервера в ключи понятных сообщений.
 * NOTE: Пользователь никогда не видит сырой текст ошибки, SQL или код ответа —
 * только спокойное объяснение, что произошло и что сделать.
 */
export type ErrorMessageKey =
  | 'errors:network'
  | 'errors:unknown'
  | 'errors:session'
  | 'errors:conflict'
  | 'errors:invalid'
  | 'errors:not_found'
  | 'errors:unavailable'
  | 'auth:error_invalid_credentials'
  | 'auth:error_email_taken'
  | 'auth:error_weak_password'
  | 'auth:error_rate_limited'
  | 'auth:error_invalid_email'
  | 'auth:error_not_configured';

interface ErrorLike {
  readonly name?: unknown;
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
}

const AUTH_CODES: Readonly<Record<string, ErrorMessageKey>> = {
  invalid_credentials: 'auth:error_invalid_credentials',
  user_already_exists: 'auth:error_email_taken',
  email_exists: 'auth:error_email_taken',
  weak_password: 'auth:error_weak_password',
  over_request_rate_limit: 'auth:error_rate_limited',
  over_email_send_rate_limit: 'auth:error_rate_limited',
  email_address_invalid: 'auth:error_invalid_email',
  validation_failed: 'errors:invalid',
  session_not_found: 'errors:session',
  refresh_token_not_found: 'errors:session',
};

const DATA_CODES: Readonly<Record<string, ErrorMessageKey>> = {
  PT401: 'errors:session',
  PT404: 'errors:not_found',
  PT409: 'errors:conflict',
  PT422: 'errors:invalid',
  // NOTE: Истёкший или неверный токен в ответе PostgREST.
  PGRST301: 'errors:session',
  PGRST303: 'errors:session',
};

export function errorMessageKey(error: unknown): ErrorMessageKey {
  if (!error || typeof error !== 'object') return 'errors:unknown';
  const value = error as ErrorLike;
  const code = typeof value.code === 'string' ? value.code : '';
  if (code in AUTH_CODES) return AUTH_CODES[code]!;
  if (code in DATA_CODES) return DATA_CODES[code]!;
  // NOTE: Сеть недоступна: у supabase-js это отдельный класс ошибки или сбой fetch.
  if (value.name === 'AuthRetryableFetchError' || value.name === 'TypeError')
    return 'errors:network';
  if (typeof value.message === 'string' && /fetch|network/i.test(value.message))
    return 'errors:network';
  if (value.status === 429) return 'auth:error_rate_limited';
  if (typeof value.status === 'number' && value.status >= 500) return 'errors:unavailable';
  return 'errors:unknown';
}

/** Конфликт версии или повтор с другим содержимым — экран надо обновить с сервера. */
export function isConflict(error: unknown): boolean {
  return errorMessageKey(error) === 'errors:conflict';
}
