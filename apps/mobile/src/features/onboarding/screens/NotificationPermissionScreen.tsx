import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { mobileLogger } from '../../../core/diagnostics/mobile-logger';
import { createPermissionService } from '../../../platform/permissions/permission-service';
import type { PermissionSnapshot } from '../../../platform/permissions/permission-service';
import { notificationAdapter } from '../../../platform/permissions/notification-adapter';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { Sheet } from '../../../shared/ui/Sheet';
import { useAmbientMotion } from '../../../shared/motion/useAmbientMotion';
import bell from '../../../../assets/illustrations/permission-bell.png';

export function NotificationPermissionScreen() {
  const { t, i18n } = useTranslation('permissions');
  const { theme } = useAppPreferences();
  const router = useRouter();
  const [permission, setPermission] = useState<PermissionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const alive = useRef(true);
  const service = useMemo(
    () =>
      createPermissionService(
        notificationAdapter(() => String(i18n.t('permissions:channel_name'))),
      ),
    [i18n],
  );
  const refresh = useCallback(async () => {
    const value = await service.inspect();
    if (alive.current) setPermission(value);
  }, [service]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      alive.current = false;
      listener.remove();
    };
  }, [refresh]);
  const { cycle } = useAmbientMotion();
  const bellMotion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(cycle.value, [0, 1], [-2, 2])}deg` }],
  }));
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const granted = permission?.state === 'granted' || permission?.state === 'quiet';
  // NOTE: В браузере сначала показываем объяснение, затем честно сообщаем об ограничении.
  const explanation =
    permission?.state === 'undetermined' || (permission?.state === 'unavailable' && !attempted);
  const title = explanation
    ? 'title'
    : permission?.state === 'denied'
      ? 'denied_title'
      : permission?.state === 'quiet'
        ? 'quiet_title'
        : permission?.state === 'granted'
          ? 'granted_title'
          : permission?.state === 'unavailable'
            ? 'unavailable_title'
            : permission?.state === 'error'
              ? 'error_title'
              : 'title';
  const body = explanation
    ? 'body'
    : permission?.state === 'denied'
      ? 'denied_body'
      : permission?.state === 'quiet'
        ? 'quiet_body'
        : permission?.state === 'granted'
          ? 'granted_body'
          : permission?.state === 'unavailable'
            ? 'unavailable_body'
            : permission?.state === 'error'
              ? 'error_body'
              : 'body';

  const request = async () => {
    if (busy) return;
    setBusy(true);
    setAttempted(true);
    const next = await service.requestFromUser();
    if (alive.current) {
      setPermission(next);
      setBusy(false);
    }
    void mobileLogger.emit('info', 'system', 'permission.checked', { status: next.state });
  };
  const settings = async () => {
    const opened = await service.openSettings();
    if (!opened && alive.current) setPermission({ state: 'error', canAskAgain: false });
  };
  return (
    <Sheet testID="permission-sheet">
      <Animated.View style={[styles.bell, bellMotion]}>
        <Image
          source={bell}
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          resizeMode="contain"
          accessibilityElementsHidden
        />
        {granted ? (
          <View
            style={[
              styles.successBadge,
              { backgroundColor: theme.primary, borderColor: theme.surface },
            ]}
          >
            <Icon name="check" color={theme.background} size={19} />
          </View>
        ) : null}
      </Animated.View>
      <AppText variant="title" style={styles.title}>
        {t(title)}
      </AppText>
      <AppText style={[styles.body, { color: theme.textMuted }]}>{t(body)}</AppText>
      {explanation ? (
        <View style={{ gap: 8 }}>
          {[
            { icon: 'leaf' as const, text: 'personal_only' },
            { icon: 'settings' as const, text: 'off_any_time' },
          ].map((row) => (
            <View key={row.text} style={[styles.reason, { backgroundColor: theme.surfaceMuted }]}>
              <Icon name={row.icon} color={theme.primary} size={23} />
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 21 }}>{t(row.text)}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      {!permission ? (
        <View style={{ minHeight: 70, alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={theme.primary} />
          <AppText variant="small">{t('checking')}</AppText>
        </View>
      ) : granted || (permission.state === 'unavailable' && !explanation) ? (
        <Button
          label={t(granted ? 'excellent' : 'understood')}
          onPress={close}
          testID="permission-dismiss"
        />
      ) : (
        <View style={{ gap: 9 }}>
          <Button
            testID="permission-primary"
            disabled={busy}
            label={
              busy
                ? t('checking')
                : t(
                    permission.state === 'denied'
                      ? 'settings'
                      : permission.state === 'error'
                        ? 'ask_again'
                        : 'allow',
                  )
            }
            onPress={() => {
              if (permission.state === 'denied') void settings();
              else if (permission.state === 'error') void refresh();
              else void request();
            }}
          />
          <Button
            testID="permission-later"
            variant="outline"
            label={t(permission.state === 'denied' ? 'leave' : 'later')}
            onPress={close}
          />
        </View>
      )}
      {explanation ? (
        <AppText variant="small" style={[styles.center, { color: theme.textMuted, fontSize: 11 }]}>
          {t('system_prompt')}
        </AppText>
      ) : null}
    </Sheet>
  );
}
const styles = StyleSheet.create({
  bell: { width: 180, height: 96, alignSelf: 'center', marginTop: 2 },
  successBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 22,
    right: 35,
    bottom: 0,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center', fontSize: 27, lineHeight: 35, marginTop: -7 },
  body: { textAlign: 'center', fontSize: 14, lineHeight: 23 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    minHeight: 60,
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  center: { textAlign: 'center' },
});
