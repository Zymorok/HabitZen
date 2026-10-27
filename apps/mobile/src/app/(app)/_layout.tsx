import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../core/auth/AuthProvider';
import { useAppPreferences } from '../../core/providers/AppPreferencesProvider';
import { ReminderSync } from '../../features/reminders/ReminderSync';

// NOTE: Всё внутри (app) — только после входа. Без сессии человек возвращается к знакомству.
export default function SignedInLayout() {
  const { status } = useAuth();
  const { theme } = useAppPreferences();
  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (status !== 'signedIn') return <Redirect href="/" />;
  return (
    <>
      <ReminderSync />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="habit/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="habit/[itemId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habit/stats/[habitId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
        {/* NOTE: «Свято» за полный день — модальный экран поверх плана (задание, HZ-11). */}
        <Stack.Screen
          name="celebration"
          options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="reminders" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="week" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="habits" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
