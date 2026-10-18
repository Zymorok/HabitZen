import '../../global.css';
import { useFonts } from 'expo-font';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AppPreferencesProvider,
  useAppPreferences,
} from '../core/providers/AppPreferencesProvider';
import { DataProvider } from '../core/providers/DataProvider';
import { AuthProvider } from '../core/auth/AuthProvider';

function Navigation() {
  const { theme } = useAppPreferences();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="preferences"
            options={{
              presentation: 'transparentModal',
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="permissions"
            options={{
              presentation: 'transparentModal',
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          />
        </Stack>
      </View>
    </View>
  );
}
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lora_600SemiBold,
    Lora_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FBF8EF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#2D6249" />
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppPreferencesProvider>
          {/* NOTE: Порядок важен: вход очищает кеш данных и читает выбранный язык. */}
          <DataProvider>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </DataProvider>
        </AppPreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
