/**
 * Хранилище сессии в браузере. В вебе защищённого хранилища ОС нет;
 * localStorage — стандартный вариант Supabase для веб-клиента.
 * WARNING: Сессия в браузере доступна скриптам этой страницы — сторонних скриптов на ней быть не должно.
 */
export const sessionStorage = {
  async getItem(name: string): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(name, value);
  },
  async removeItem(name: string): Promise<void> {
    globalThis.localStorage?.removeItem(name);
  },
};
