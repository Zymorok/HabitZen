import { Pressable, StyleSheet } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
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

/** Подложка нижнего меню: цвет плавно меняется вместе с темой. */
function Bar({ children }: { readonly children: ReactNode }) {
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
      {children}
    </Animated.View>
  );
}

/**
 * Нижнее меню на экранах поверх вкладок — удержание и «Отлично!» (кадры 04–05), как в макете.
 * NOTE: Нажатие закрывает экран и переходит на выбранную вкладку.
 */
export function StackTabBar({ active }: { readonly active: keyof typeof TABS }) {
  const router = useRouter();
  return (
    <Bar>
      {Object.entries(TABS).map(([name, tab]) => (
        <TabButton
          key={name}
          name={name}
          icon={tab.icon}
          labelKey={tab.label}
          focused={name === active}
          testPrefix="stack-tab"
          onPress={() => {
            if (router.canDismiss()) router.dismissAll();
            router.navigate(`/${name}` as '/today');
          }}
        />
      ))}
    </Bar>
  );
}

/** Нижнее меню как в макете: значок и подпись, выбранный пункт — зелёный и чуть крупнее. */
export function TabBar({ state, navigation }: TabBarProps) {
  return (
    <Bar>
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
    </Bar>
  );
}

function TabButton({
  name,
  icon,
  labelKey,
  focused,
  onPress,
  testPrefix = 'tab',
}: {
  readonly name: string;
  readonly icon: IconName;
  readonly labelKey: string;
  readonly focused: boolean;
  readonly onPress: () => void;
  readonly testPrefix?: string;
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
      testID={`${testPrefix}-${name}`}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2 : 1.7} />
      </Animated.View>
      <Animated.Text
        maxFontSizeMultiplier={1.2}
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
