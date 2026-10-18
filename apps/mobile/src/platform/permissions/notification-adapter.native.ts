import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileLogger } from '../../core/diagnostics/mobile-logger';
import { withRequestHistory } from './permission-service';
import type { PermissionAdapter, PermissionSnapshot } from './permission-service';

function snapshot(status: Notifications.NotificationPermissionsStatus): PermissionSnapshot {
  if (
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return { state: 'quiet', canAskAgain: status.canAskAgain };
  }
  if (status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return { state: 'granted', canAskAgain: false };
  }
  return {
    state: status.status === 'denied' ? 'denied' : 'undetermined',
    canAskAgain: status.canAskAgain,
  };
}

export function notificationAdapter(channelName: () => string): PermissionAdapter {
  const requestedKey = 'habitzen.permissions.notifications.requested.v1';
  let requestedInSession = false;
  return {
    async inspect() {
      const current = snapshot(await Notifications.getPermissionsAsync());
      const hasRequested =
        requestedInSession || (await AsyncStorage.getItem(requestedKey)) === 'true';
      return Platform.OS === 'android' ? withRequestHistory(current, hasRequested) : current;
    },
    async request() {
      requestedInSession = true;
      try {
        await AsyncStorage.setItem(requestedKey, 'true');
      } catch {
        void mobileLogger.emit('warning', 'system', 'permission.history_write_failed');
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('gentle-reminders', {
          name: channelName(),
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      return snapshot(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      );
    },
    async openSettings() {
      await Linking.openSettings();
    },
  };
}
