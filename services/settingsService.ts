import { doc, getDoc, setDoc } from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_SETTINGS, SETTINGS_DOC_ID, STORAGE_KEYS } from '../constants/config';
import { ShopSettings } from '../types/report';
import { firestore } from './firebase';
import { readJson, writeJson } from './localStore';
import { isOnline } from './networkService';

/**
 * SHOP SETTINGS: READ / WRITE PATTERN
 * --------------------------------------
 * Single document (settings/shop) holding things like the shop's split
 * percentage and minimum service price. Any signed-in user can READ it
 * (needed on-device to validate a sale before it's even sent), but only an
 * admin can WRITE to it. One-time getDoc()/setDoc() calls, with the usual
 * AsyncStorage cache fallback for offline/failed reads. Firestore's own
 * security rules independently re-check the split percentage against this
 * document on every transaction write, so even a tampered client can't
 * submit a sale with the wrong split.
 */
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
