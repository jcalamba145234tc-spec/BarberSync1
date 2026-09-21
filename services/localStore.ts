import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin typed wrapper around AsyncStorage.
 * Used for offline caching, the pending-sync queue and local mode storage.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[BarberSync] Could not read ${key}`, error);
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[BarberSync] Could not save ${key}`, error);
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`[BarberSync] Could not remove ${key}`, error);
  }
}

/** Generates a stable local id. Also used to prevent duplicate syncs. */
export function createLocalId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
