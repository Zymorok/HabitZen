import { describe, expect, it, vi } from 'vitest';
import { createPermissionService } from '../../apps/mobile/src/platform/permissions/permission-service';
import type {
  PermissionAdapter,
  PermissionSnapshot,
} from '../../apps/mobile/src/platform/permissions/permission-service';

const undetermined: PermissionSnapshot = { state: 'undetermined', canAskAgain: true };
const granted: PermissionSnapshot = { state: 'granted', canAskAgain: false };
function adapter(snapshot: PermissionSnapshot = undetermined): PermissionAdapter {
  return {
    inspect: vi.fn(async () => snapshot),
    request: vi.fn(async () => granted),
    openSettings: vi.fn(async () => undefined),
  };
}
describe('Запрос уведомлений только по желанию пользователя', () => {
  it('простая проверка разрешения не вызывает системный запрос', async () => {
    const platform = adapter();
    await createPermissionService(platform).inspect();
    expect(platform.request).not.toHaveBeenCalled();
  });
  it('повторное нажатие во время запроса не открывает два диалога', async () => {
    let finish: (value: PermissionSnapshot) => void = () => undefined;
    const platform = adapter();
    platform.request = vi.fn(
      () =>
        new Promise<PermissionSnapshot>((resolve) => {
          finish = resolve;
        }),
    );
    const service = createPermissionService(platform);
    const first = service.requestFromUser();
    const second = service.requestFromUser();
    await vi.waitFor(() => expect(platform.request).toHaveBeenCalledTimes(1));
    finish(granted);
    expect(await first).toEqual(granted);
    expect(await second).toEqual(granted);
  });
  it.each<PermissionSnapshot>([
    granted,
    { state: 'quiet', canAskAgain: true },
    { state: 'denied', canAskAgain: false },
    { state: 'unavailable', canAskAgain: false },
  ])('не переспрашивает разрешение при состоянии $state', async (snapshot) => {
    const platform = adapter(snapshot);
    expect(await createPermissionService(platform).requestFromUser()).toEqual(snapshot);
    expect(platform.request).not.toHaveBeenCalled();
  });
  it('разрешает повторный запрос только если ОС это допускает', async () => {
    const platform = adapter({ state: 'denied', canAskAgain: true });
    await createPermissionService(platform).requestFromUser();
    expect(platform.request).toHaveBeenCalledTimes(1);
  });
  it('не выдаёт сбой ОС за полученное разрешение', async () => {
    const platform = adapter();
    platform.request = vi.fn(async () => {
      throw new Error('Сырая ошибка платформы');
    });
    expect(await createPermissionService(platform).requestFromUser()).toEqual({
      state: 'error',
      canAskAgain: false,
    });
  });
  it('не выдаёт невозможность открыть настройки за успех', async () => {
    const platform = adapter();
    platform.openSettings = vi.fn(async () => {
      throw new Error('Недоступно');
    });
    expect(await createPermissionService(platform).openSettings()).toBe(false);
  });
});
