import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRef } from 'react';
import Animated, { FadeIn, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { habitColor, habitIcon } from '../../../shared/habit-look';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import type { PlanItem } from '../data/plan-api';

/**
 * Строка плана (кадр 02): значок, название, кружок состояния.
 * Нажатие — к удержанию (кадр 04); свайп влево — «Сегодня отдых»; долгое нажатие — меню.
 * NOTE: Для озвучивания те же действия доступны через accessibilityActions — жест не обязателен.
 */
export function PlanRow({
  item,
  busy,
  last,
  onOpen,
  onSkip,
  onMenu,
}: {
  readonly item: PlanItem;
  readonly busy: boolean;
  readonly last: boolean;
  readonly onOpen: () => void;
  readonly onSkip: () => void;
  readonly onMenu: () => void;
}) {
  const { t } = useTranslation('habits');
  const { theme } = useAppPreferences();
  const swipe = useRef<SwipeableMethods>(null);
  const color = habitColor(item.colorKey);
  const done = item.status === 'completed';
  const resting = item.status === 'skipped';
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={item.status === 'pending' && !busy}
      friction={1.6}
      rightThreshold={64}
      overshootRight={false}
      renderRightActions={(progress) => <RestAction progress={progress} />}
      onSwipeableOpen={() => {
        swipe.current?.close();
        if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
        onSkip();
      }}
    >
      <Pressable
        onPress={onOpen}
        onLongPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityState={{ checked: done, busy }}
        accessibilityActions={[
          { name: 'activate', label: t('hold') },
          { name: 'longpress', label: t('menu') },
        ]}
        onAccessibilityAction={(event) =>
          event.nativeEvent.actionName === 'longpress' ? onMenu() : onOpen()
        }
        testID="plan-row"
        style={[
          styles.row,
          { backgroundColor: theme.surface },
          !last ? { borderBottomColor: theme.border } : null,
          !last ? styles.divider : null,
        ]}
      >
        <View style={[styles.badge, { backgroundColor: color + '1F' }]}>
          <Icon name={habitIcon(item.iconKey)} size={19} color={color} strokeWidth={1.9} />
        </View>
        <AppText
          numberOfLines={1}
          style={[
            styles.title,
            resting ? { color: theme.textMuted, textDecorationLine: 'line-through' } : null,
          ]}
        >
          {item.title}
        </AppText>
        {busy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : resting ? (
          <View style={[styles.restChip, { backgroundColor: theme.surfaceMuted }]}>
            <Icon name="moon" size={13} color={theme.textMuted} />
            <AppText variant="small" style={{ color: theme.textMuted }}>
              {t('rest_label')}
            </AppText>
          </View>
        ) : done ? (
          <Animated.View
            entering={FadeIn.duration(260)}
            style={[styles.check, { backgroundColor: theme.success, borderColor: theme.success }]}
          >
            <Icon name="check" size={14} color="#FFFDF3" strokeWidth={2.6} />
          </Animated.View>
        ) : (
          <View style={[styles.check, { borderColor: theme.primarySoft }]} />
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** Подложка свайпа: «Сегодня отдых» проявляется по мере сдвига строки. */
function RestAction({ progress }: { readonly progress: SharedValue<number> }) {
  const { t } = useTranslation('habits');
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));
  return (
    <View style={styles.restAction}>
      <Animated.View style={[styles.restInner, style]}>
        <Icon name="moon" size={18} color="#8A5A2B" />
        <AppText variant="small" style={styles.restText}>
          {t('skipped')}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, lineHeight: 21 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  restAction: {
    width: 132,
    backgroundColor: '#FBE3C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restInner: { alignItems: 'center', gap: 3 },
  restText: { color: '#8A5A2B', fontFamily: 'Manrope_600SemiBold' },
});
