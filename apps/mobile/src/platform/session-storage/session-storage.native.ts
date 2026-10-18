import * as SecureStore from 'expo-secure-store';

/**
 * Хранилище сессии входа на телефоне — в защищённом хранилище ОС (Keystore / Keychain).
 * WARNING: SecureStore надёжно хранит только небольшие значения (~2 КБ), а сессия Supabase
 * бывает больше. Поэтому значение режется на части, а число частей хранится отдельно.
 */
const CHUNK = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? '0');
  for (let index = 0; index < count; index++) {
    await SecureStore.deleteItemAsync(`${key}.${index}`);
  }
  await SecureStore.deleteItemAsync(`${key}.count`);
}

export const sessionStorage = {
  async getItem(name: string): Promise<string | null> {
    const key = safeKey(name);
    const count = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? '0');
    if (!count) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index++) {
      const part = await SecureStore.getItemAsync(`${key}.${index}`);
      // NOTE: Если часть пропала (например, после переустановки), сессия считается отсутствующей.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(name: string, value: string): Promise<void> {
    const key = safeKey(name);
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let index = 0; index < count; index++) {
      await SecureStore.setItemAsync(
        `${key}.${index}`,
        value.slice(index * CHUNK, (index + 1) * CHUNK),
      );
    }
    await SecureStore.setItemAsync(`${key}.count`, String(count));
  },
  async removeItem(name: string): Promise<void> {
    await removeChunks(safeKey(name));
  },
};
