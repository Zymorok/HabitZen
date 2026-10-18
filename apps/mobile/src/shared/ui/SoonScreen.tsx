import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTheme, lightTheme } from '@habitzen/design/tokens';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { ThemedText } from './ThemedText';

/**
 * Честная заглушка вкладки, которая появится на следующем этапе: картинка мира,
 * заголовок и одна фраза о том, что здесь будет. Без кнопок, которые ничего не делают.
 */
export function SoonScreen({
  title,
  body,
  image,
  testID,
}: {
  readonly title: string;
  readonly body: string;
  readonly image: ImageSourcePropType;
  readonly testID: string;
}) {
  const insets = useSafeAreaInsets();
  const { night } = useAppPreferences();
  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      night.value,
      [0, 1],
      [lightTheme.background, darkTheme.background],
    ),
  }));
  return (
    <Animated.View
      style={[styles.shell, shellStyle, { paddingTop: Math.max(insets.top, 20) + 20 }]}
      testID={testID}
    >
      <Animated.View entering={FadeInDown.duration(380)} style={styles.art}>
        <Image source={image} style={styles.image} resizeMode="contain" />
      </Animated.View>
      <View style={styles.text}>
        <ThemedText variant="title" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText tone="textMuted" style={styles.body}>
          {body}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 18 },
  art: { width: '86%', maxWidth: 340, aspectRatio: 1.4 },
  image: { width: '100%', height: '100%' },
  text: { alignItems: 'center', gap: 8 },
  title: { textAlign: 'center', fontSize: 23, lineHeight: 31 },
  body: { textAlign: 'center', maxWidth: 320 },
});
