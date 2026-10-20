import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { notificationAdapter } from './notification-adapter';
import { createPermissionService } from './permission-service';
import type { PermissionSnapshot } from './permission-service';

/**
 * Разрешение на уведомления для напоминаний и таймера.
 * NOTE: Состояние перечитывается при возвращении в приложение — человек мог разрешить
 * уведомления в настройках телефона. Запрос ОС — только по явному нажатию.
 */
export function useNotificationPermission() {
  const { i18n } = useTranslation();
  const service = useMemo(
    () =>
      createPermissionService(
        notificationAdapter(() => String(i18n.t('permissions:channel_name'))),
      ),
    [i18n],
  );
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const value = await service.inspect();
    setSnapshot(value);
    return value;
  }, [service]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const value = await service.requestFromUser();
    setSnapshot(value);
    return value;
  }, [service]);

  const openSettings = useCallback(() => service.openSettings(), [service]);

  return {
    state: snapshot?.state ?? null,
    canAskAgain: snapshot?.canAskAgain ?? false,
    granted: snapshot?.state === 'granted' || snapshot?.state === 'quiet',
    request,
    openSettings,
    refresh,
  };
}
