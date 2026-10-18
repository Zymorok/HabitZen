// NOTE: Публичные настройки сборки. Секретов здесь нет и быть не может: всё EXPO_PUBLIC_* видно в приложении.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
