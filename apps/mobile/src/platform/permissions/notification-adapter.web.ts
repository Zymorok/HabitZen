import type { PermissionAdapter } from './permission-service';

// NOTE: Веб-просмотр не просит браузерное разрешение вместо разрешения мобильного приложения.
export function notificationAdapter(_channelName: () => string): PermissionAdapter {
  void _channelName;
  return {
    async inspect() {
      return { state: 'unavailable', canAskAgain: false };
    },
    async request() {
      return { state: 'unavailable', canAskAgain: false };
    },
    async openSettings() {
      throw new Error('Настройки телефона недоступны в браузере.');
    },
  };
}
