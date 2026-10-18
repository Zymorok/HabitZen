import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';

export interface MenuAction {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  readonly danger?: boolean;
  readonly onPress: () => void;
}

/** Нижнее меню действий над привычкой (долгое нажатие на строку или «⋮» на кадре 04). */
export function RowMenu({
  title,
  actions,
  visible,
  onClose,
}: {
  readonly title: string;
  readonly actions: readonly MenuAction[];
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const { theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('close')}
        />
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 14) },
          ]}
          testID="row-menu"
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <AppText variant="button" style={styles.title} numberOfLines={1}>
            {title}
          </AppText>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              accessibilityRole="button"
              testID={`menu-${action.key}`}
              style={styles.item}
            >
              <Icon
                name={action.icon}
                size={20}
                color={action.danger ? theme.error : theme.primary}
              />
              <AppText style={{ color: action.danger ? theme.error : theme.text }}>
                {action.label}
              </AppText>
            </Pressable>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,22,16,0.35)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 2,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  title: { paddingHorizontal: 6, paddingBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 6,
  },
});
