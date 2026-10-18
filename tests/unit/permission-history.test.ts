import { describe, expect, it } from 'vitest';
import { withRequestHistory } from '../../apps/mobile/src/platform/permissions/permission-service';

describe('история системного запроса', () => {
  it('первичный статус Android не выдаётся за отказ пользователя', () => {
    expect(withRequestHistory({ state: 'denied', canAskAgain: true }, false)).toEqual({
      state: 'undetermined',
      canAskAgain: true,
    });
  });
  it('настоящий отказ остаётся отказом после перезапуска', () => {
    expect(withRequestHistory({ state: 'denied', canAskAgain: true }, true)).toEqual({
      state: 'denied',
      canAskAgain: true,
    });
  });
  it('запрет повторного запроса ОС всегда сохраняется', () => {
    expect(withRequestHistory({ state: 'denied', canAskAgain: false }, false)).toEqual({
      state: 'denied',
      canAskAgain: false,
    });
  });
  it('выданное разрешение не зависит от локальной истории', () => {
    expect(withRequestHistory({ state: 'granted', canAskAgain: false }, false)).toEqual({
      state: 'granted',
      canAskAgain: false,
    });
  });
});
