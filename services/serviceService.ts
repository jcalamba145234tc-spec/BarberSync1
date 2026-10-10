import { collection, deleteDoc, doc, getDocs, query, where, limit, setDoc, updateDoc } from 'firebase/firestore';
import { COLLECTIONS, STORAGE_KEYS } from '../constants/config';
import { BarberService, ServiceInput } from '../types/service';
import { firestore } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';

/**
 * SERVICES (the menu/price list): READ / WRITE PATTERN
 * -------------------------------------------------------
 * Any signed-in user can READ this collection (barbers need prices to log a
 * sale) but only an admin can WRITE to it - enforced in firestore.rules.
 * This helper uses getDocs() with a cache fallback; AppDataContext also
 * listens through liveData.ts for shared menu changes.
 * same pattern as the rest of the app. Writes use setDoc(..., { merge: true })
 * for create/update and deleteDoc() for removal, with updateDoc() used for
 * the narrower active/inactive toggle.
 */
export const DEFAULT_SERVICES: ServiceInput[] = [
  { name: 'Haircut', price: 150, durationMinutes: 20, active: true },
  { name: 'Haircut + Beard', price: 200, durationMinutes: 30, active: true },
  { name: 'Beard Trim', price: 150, durationMinutes: 15, active: true },
  { name: 'Kids Haircut', price: 150, durationMinutes: 20, active: true },
];

async function cache(services: BarberService[]): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedServices, services);
}

export async function getServices(includeInactive = false, cacheOnly = false): Promise<BarberService[]> {
  let services: BarberService[] = [];
  if (!cacheOnly && firestore && (await isOnline())) {
    try {
      const snapshot = await getDocs(collection(firestore, COLLECTIONS.services));
      services = snapshot.docs.map((d) => ({ ...(d.data() as BarberService), id: d.id }));
      if (services.length) await cache(services);
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached services.', error);
    }
  }
  if (!services.length) {
    services = await readJson<BarberService[]>(STORAGE_KEYS.cachedServices, []);
  }
  if (!services.length) {
    // First run with no data yet: start from the editable default menu.
    services = DEFAULT_SERVICES.map((service) => ({
      ...service,
      id: createLocalId('svc'),
      createdAt: new Date().toISOString(),
    }));
    await cache(services);
  }
  const sorted = services.sort((a, b) => a.name.localeCompare(b.name));
  return includeInactive ? sorted : sorted.filter((s) => s.active);
}

export async function saveService(
  input: ServiceInput,
  existingId?: string
): Promise<BarberService> {
  const service: BarberService = {
    id: existingId ?? createLocalId('svc'),
    createdAt: new Date().toISOString(),
    ...input,
  };
  const cached = await readJson<BarberService[]>(STORAGE_KEYS.cachedServices, []);
  const next = existingId
    ? cached.map((s) => (s.id === existingId ? { ...s, ...input } : s))
    : [...cached, service];
  await cache(next);

  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.services, service.id), service, { merge: true });
    } catch (error) {
      console.warn('[BarberSync] Could not save service remotely.', error);
    }
  }
  return service;
}

/**
 * Services are never hard-deleted while history may reference them.
 * Deactivating keeps old transactions accurate.
 */
export async function setServiceActive(id: string, active: boolean): Promise<void> {
  const cached = await readJson<BarberService[]>(STORAGE_KEYS.cachedServices, []);
  await cache(cached.map((s) => (s.id === id ? { ...s, active } : s)));
  if (firestore && (await isOnline())) {
    try {
      await updateDoc(doc(firestore, COLLECTIONS.services, id), { active });
    } catch (error) {
      console.warn('[BarberSync] Could not update service remotely.', error);
    }
  }
}

/** Only allowed when the service has never been used in a transaction. */
export async function deleteService(id: string): Promise<void> {
  const cached = await readJson<BarberService[]>(STORAGE_KEYS.cachedServices, []);
  await cache(cached.filter((s) => s.id !== id));
  if (firestore && (await isOnline())) {
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.services, id));
    } catch (error) {
      console.warn('[BarberSync] Could not delete service remotely.', error);
    }
  }
}

export async function replaceCachedServices(services: BarberService[]): Promise<void> {
  await cache(services);
}

/** Check history at deletion time, not via a costly full-history listener. */
export async function serviceHasTransactions(id: string): Promise<boolean> {
  const cached = await readJson<{ serviceId: string }[]>(STORAGE_KEYS.cachedTransactions, []);
  if (cached.some((t) => t.serviceId === id)) return true;
  if (!firestore) return false;
  if (!(await isOnline())) throw new Error('Connect to check service history before deleting.');
  const snap = await getDocs(query(collection(firestore, COLLECTIONS.transactions),
    where('serviceId', '==', id), limit(1)));
  return !snap.empty;
}
