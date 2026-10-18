import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '../../../shared/ui/ThemedText';

/** Тихая ссылка-кнопка под формой: «Забыли пароль?», «Нет аккаунта? Создать». */
export function TextLink({
  label,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      testID={testID}
      hitSlop={6}
      style={styles.link}
    >
      {({ pressed }) => (
        <ThemedText
          variant="button"
          tone="primary"
          style={[styles.text, { opacity: pressed ? 0.6 : 1 }]}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 14, textAlign: 'center' },
});
