import { doc, getDoc, setDoc } from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_SETTINGS, SETTINGS_DOC_ID, STORAGE_KEYS } from '../constants/config';
import { ShopSettings } from '../types/report';
import { firestore } from './firebase';
import { readJson, writeJson } from './localStore';
import { isOnline } from './networkService';

export async function getSettings(): Promise<ShopSettings> {
  if (firestore && (await isOnline())) {
    try {
      const snapshot = await getDoc(doc(firestore, COLLECTIONS.settings, SETTINGS_DOC_ID));
      if (snapshot.exists()) {
        const settings = { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<ShopSettings>) };
        await writeJson(STORAGE_KEYS.cachedSettings, settings);
        return settings;
      }
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached settings.', error);
    }
  }
  return readJson<ShopSettings>(STORAGE_KEYS.cachedSettings, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: ShopSettings): Promise<ShopSettings> {
  // The split always has to add up to 100%.
  const normalized: ShopSettings = {
    ...settings,
    barberPercentage: Math.round((1 - settings.shopPercentage) * 100) / 100,
  };
  await writeJson(STORAGE_KEYS.cachedSettings, normalized);
  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.settings, SETTINGS_DOC_ID), normalized, { merge: true });
    } catch (error) {
      console.warn('[BarberSync] Settings saved locally only.', error);
    }
  }
  return normalized;
}
