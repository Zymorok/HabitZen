import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { Icon } from '../../../shared/ui/Icon';
import type { IconName } from '../../../shared/ui/Icon';

/**
 * Медаль достижения: открытая — золотой круг с белым значком, закрытая — бледная с замочком.
 * NOTE: Золото одно для всех цветовых тем: это награда, а не оформление.
 */
export function Badge({
  icon,
  unlocked,
  size = 64,
}: {
  readonly icon: IconName;
  readonly unlocked: boolean;
  readonly size?: number;
}) {
  const { theme, isDark } = useAppPreferences();
  return (
    <View style={{ width: size, height: size }}>
      {unlocked ? (
        <LinearGradient
          colors={['#F8D27A', '#E39A3B']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.circle, { borderRadius: size / 2 }, styles.glow]}
        >
          <View style={[styles.inner, { borderRadius: size / 2 - 5 }]} />
          <Icon name={icon} size={size * 0.46} color="#FFFDF3" strokeWidth={2.2} />
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.circle,
            { borderRadius: size / 2, backgroundColor: isDark ? theme.surfaceMuted : '#ECEDE5' },
          ]}
        >
          <Icon name={icon} size={size * 0.42} color={theme.textMuted} strokeWidth={1.8} />
          <View
            style={[styles.lock, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Icon name="lock" size={12} color={theme.textMuted} strokeWidth={2} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { boxShadow: '0 6px 16px rgba(227,154,59,0.35)' },
  inner: {
    position: 'absolute',
    left: 5,
    top: 5,
    right: 5,
    bottom: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,253,243,0.55)',
  },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
