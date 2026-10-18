import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { AppText } from '../../../shared/ui/AppText';

/** Сообщение под формой: ошибка — мягким красным, успех — зелёным. Озвучивается сразу. */
export function FormNotice({
  message,
  tone,
  testID,
}: {
  readonly message: string | null;
  readonly tone: 'error' | 'success';
  readonly testID: string;
}) {
  const { theme } = useAppPreferences();
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      accessibilityLiveRegion="polite"
      style={[
        styles.box,
        { backgroundColor: tone === 'error' ? 'rgba(182,71,71,0.1)' : 'rgba(59,128,86,0.1)' },
      ]}
    >
      <AppText
        testID={testID}
        style={[styles.text, { color: tone === 'error' ? theme.error : theme.success }]}
      >
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontSize: 14, lineHeight: 20 },
});
