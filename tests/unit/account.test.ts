import { describe, expect, it } from 'vitest';
import {
  emailProblem,
  passwordProblem,
  recoveryTokens,
} from '../../apps/mobile/src/features/auth/validation';
import { errorMessageKey, isConflict } from '../../apps/mobile/src/core/supabase/errors';
import {
  ALL_WEEKDAYS,
  describeWeekdays,
  hasWeekday,
  toggleWeekday,
} from '../../apps/mobile/src/features/habits/weekdays';

const SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

describe('форма входа', () => {
  it('сразу подсказывает про пустую или неверную почту', () => {
    expect(emailProblem('   ')).toBe('email_required');
    expect(emailProblem('valeria')).toBe('error_invalid_email');
    expect(emailProblem(' valeria@example.com ')).toBeNull();
  });
  it('требует пароль не короче 8 символов', () => {
    expect(passwordProblem('1234567')).toBe('password_short');
    expect(passwordProblem('12345678')).toBeNull();
  });
  it('достаёт сессию из ссылки письма и отвергает неполную ссылку', () => {
    expect(
      recoveryTokens(
        'http://localhost:8097/auth/callback#access_token=a.b.c&refresh_token=r1&type=recovery',
      ),
    ).toEqual({ accessToken: 'a.b.c', refreshToken: 'r1' });
    expect(recoveryTokens('habitzen://auth/callback?access_token=x&refresh_token=y')).toEqual({
      accessToken: 'x',
      refreshToken: 'y',
    });
    expect(recoveryTokens('http://localhost:8097/auth/callback#error=access_denied')).toBeNull();
  });
});

describe('понятные ошибки вместо сырых ответов сервера', () => {
  it('различает ошибки входа', () => {
    expect(errorMessageKey({ code: 'invalid_credentials', status: 400 })).toBe(
      'auth:error_invalid_credentials',
    );
    expect(errorMessageKey({ code: 'user_already_exists', status: 422 })).toBe(
      'auth:error_email_taken',
    );
    expect(errorMessageKey({ code: 'weak_password' })).toBe('auth:error_weak_password');
    expect(errorMessageKey({ status: 429 })).toBe('auth:error_rate_limited');
  });
  it('различает ответы команд привычек', () => {
    expect(errorMessageKey({ code: 'PT409', message: 'revision_conflict' })).toBe(
      'errors:conflict',
    );
    expect(isConflict({ code: 'PT409', message: 'request_conflict' })).toBe(true);
    expect(errorMessageKey({ code: 'PT404' })).toBe('errors:not_found');
    expect(errorMessageKey({ code: 'PT401' })).toBe('errors:session');
    expect(errorMessageKey({ code: 'PT422' })).toBe('errors:invalid');
  });
  it('сеть и сбой сервера не выдаются за ошибку человека', () => {
    expect(errorMessageKey({ name: 'AuthRetryableFetchError' })).toBe('errors:network');
    expect(errorMessageKey(new TypeError('Failed to fetch'))).toBe('errors:network');
    expect(errorMessageKey({ status: 503 })).toBe('errors:unavailable');
    expect(errorMessageKey('строка')).toBe('errors:unknown');
  });
});

describe('дни недели привычки', () => {
  it('переключает день и описывает выбор по порядку недели', () => {
    let mask = ALL_WEEKDAYS;
    expect(describeWeekdays(mask, SHORT, 'Каждый день')).toBe('Каждый день');
    mask = toggleWeekday(mask, 6);
    expect(hasWeekday(mask, 6)).toBe(false);
    expect(describeWeekdays(mask, SHORT, 'Каждый день')).toBe('Пн, Вт, Ср, Чт, Пт, Сб');
    mask = toggleWeekday(toggleWeekday(0, 4), 0);
    expect(describeWeekdays(mask, SHORT, 'Каждый день')).toBe('Пн, Пт');
  });
});
