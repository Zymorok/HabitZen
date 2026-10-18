import { Pressable, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Tabs } from 'expo-router';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../core/providers/AppPreferencesProvider';
import { Icon } from '../shared/ui/Icon';
import type { IconName } from '../shared/ui/Icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Readonly<Record<string, { icon: IconName; label: string }>> = {
  today: { icon: 'home', label: 'today' },
  focus: { icon: 'timer', label: 'focus' },
  progress: { icon: 'chart', label: 'progress' },
  profile: { icon: 'user', label: 'profile' },
};

/** Нижнее меню как в макете: значок и подпись, выбранный пункт — зелёный и чуть крупнее. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { night } = useAppPreferences();
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.value, [0, 1], [lightTheme.surface, darkTheme.surface]),
    borderTopColor: interpolateColor(night.value, [0, 1], [lightTheme.border, darkTheme.border]),
  }));
  return (
    <Animated.View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }, barStyle]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        return (
          <TabButton
            key={route.key}
            name={route.name}
            icon={tab.icon}
            labelKey={tab.label}
            focused={state.index === index}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </Animated.View>
  );
}

function TabButton({
  name,
  icon,
  labelKey,
  focused,
  onPress,
}: {
  readonly name: string;
  readonly icon: IconName;
  readonly labelKey: string;
  readonly focused: boolean;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation('common');
  const { theme } = useAppPreferences();
  const active = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, motion.spring);
  }, [focused, active]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -active.value * 2 }, { scale: 1 + active.value * 0.08 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: active.value }],
  }));
  const color = focused ? theme.primary : theme.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      aria-selected={focused}
      accessibilityLabel={t(labelKey)}
      testID={`tab-${name}`}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2 : 1.7} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.label,
          { color, fontFamily: focused ? 'Manrope_600SemiBold' : 'Manrope_500Medium' },
        ]}
      >
        {t(labelKey)}
      </Animated.Text>
      <Animated.View style={[styles.dot, { backgroundColor: theme.primary }, dotStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 14 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});
