import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionStorage } from '../../platform/session-storage/session-storage';

// NOTE: В приложение попадают только публичный адрес и публикуемый ключ. Права проверяет сервер (RLS и RPC).
// WARNING: Только запись через точку: Expo подставляет EXPO_PUBLIC_* при сборке лишь в таком виде.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Клиент Supabase или null, если окружение не настроено.
 * NOTE: Без настроек знакомство с приложением работает, а экраны входа честно говорят,
 * что сервер недоступен, — вместо падения при запуске.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: sessionStorage,
          autoRefreshToken: true,
          persistSession: true,
          // NOTE: Ссылку восстановления пароля разбирает свой экран auth/callback.
          detectSessionInUrl: false,
        },
      })
    : null;

// NOTE: На телефоне продление токена работает только пока приложение на экране.
// В фоне оно останавливается, иначе таймер пытается обновить сессию без сети.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
