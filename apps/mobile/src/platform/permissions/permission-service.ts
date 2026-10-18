export type PermissionState =
  'undetermined' | 'granted' | 'quiet' | 'denied' | 'unavailable' | 'error';
export interface PermissionSnapshot {
  readonly state: PermissionState;
  readonly canAskAgain: boolean;
}
export interface PermissionAdapter {
  inspect(): Promise<PermissionSnapshot>;
  request(): Promise<PermissionSnapshot>;
  openSettings(): Promise<void>;
}
export function withRequestHistory(
  current: PermissionSnapshot,
  hasRequested: boolean,
): PermissionSnapshot {
  // NOTE: Android может вернуть denied до первого показа диалога; это ещё не отказ человека.
  if (!hasRequested && current.state === 'denied' && current.canAskAgain) {
    return { state: 'undetermined', canAskAgain: true };
  }
  return current;
}
export function createPermissionService(adapter: PermissionAdapter) {
  let requestInFlight: Promise<PermissionSnapshot> | null = null;
  const inspect = async (): Promise<PermissionSnapshot> => {
    try {
      return await adapter.inspect();
    } catch {
      return { state: 'error', canAskAgain: false };
    }
  };
  return {
    inspect,
    requestFromUser(): Promise<PermissionSnapshot> {
      // NOTE: Запрос ОС вызывается только явным нажатием; повторное нажатие использует тот же запрос.
      if (requestInFlight) return requestInFlight;
      requestInFlight = (async () => {
        const current = await inspect();
        if (
          current.state === 'granted' ||
          current.state === 'quiet' ||
          current.state === 'unavailable'
        )
          return current;
        if (current.state === 'error' || !current.canAskAgain) return current;
        try {
          return await adapter.request();
        } catch {
          return { state: 'error' as const, canAskAgain: false };
        }
      })().finally(() => {
        requestInFlight = null;
      });
      return requestInFlight;
    },
    async openSettings(): Promise<boolean> {
      try {
        await adapter.openSettings();
        return true;
      } catch {
        return false;
      }
    },
  };
}
