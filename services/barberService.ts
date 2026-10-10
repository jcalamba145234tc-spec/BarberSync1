import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { COLLECTIONS, DEMO_ACCOUNTS, STORAGE_KEYS } from '../constants/config';
import { AppUser, BarberInput } from '../types/auth';
import { Transaction } from '../types/transaction';
import { firebaseConfig, firestore, isFirebaseConfigured } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';

/**
 * BARBERS (staff profiles, users/ collection): READ / WRITE PATTERN
 * ----------------------------------------------------------------------
 * READS: a barber can only read their OWN profile document; only an admin
 * can list every barber (firestore.rules: isSelf(userId) || isAdmin()).
 * That's why the full barbers list is only fetched for admin accounts (see
 * AppDataContext.tsx's refreshBarbers) - a barber calling this would always
 * get permission-denied, since Firestore can't prove a list query is safe
 * when the rule depends on each document's own ID.
 * WRITES: setDoc(..., { merge: true }) for create/update, updateDoc() for
 * the narrower active/inactive toggle, deleteDoc() for removal - all
 * admin-only. This file also calls Firebase Auth directly
 * (createUserWithEmailAndPassword) since adding a barber means creating
 * both a login account and a Firestore profile document.
 */
export const DEFAULT_BARBERS: AppUser[] = [
  {
    id: 'demo-barber-1',
    name: DEMO_ACCOUNTS.barbers[0]?.name ?? 'Juan Dela Cruz',
    email: DEMO_ACCOUNTS.barbers[0]?.email ?? 'barber@barbersync.test',
    role: 'BARBER',
    phone: '09181234567',
    active: true,
    createdAt: new Date().toISOString(),
    specialties: ['Classic Cut', 'Fade', 'Beard Trim'],
    commissionRate: 0.5,
    notes: 'Senior Barber with 5+ years experience. Specializes in skin fades.',
  },
  {
    id: 'demo-barber-2',
    name: DEMO_ACCOUNTS.barbers[1]?.name ?? 'Mark Reyes',
    email: DEMO_ACCOUNTS.barbers[1]?.email ?? 'barber2@barbersync.test',
    role: 'BARBER',
    phone: '09199876543',
    active: true,
    createdAt: new Date().toISOString(),
    specialties: ['Modern Fade', 'Hair Color', 'Styling'],
    commissionRate: 0.5,
    notes: 'Expert in modern trends, textured crops, and color treatments.',
  },
];

async function cache(barbers: AppUser[]): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedBarbers, barbers);
}

/**
 * Retrieves all barbers. Admin management screens pass includeInactive = true
 * so they can reactivate or update staff.
 */
export async function getBarbers(includeInactive = false, cacheOnly = false): Promise<AppUser[]> {
  let barbers: AppUser[] = [];

  if (!cacheOnly && firestore && (await isOnline())) {
    try {
      const q = query(collection(firestore, COLLECTIONS.users), where('role', '==', 'BARBER'));
      const snapshot = await getDocs(q);
      barbers = snapshot.docs.map((d) => {
        const data = d.data() as Partial<AppUser>;
        return {
          id: d.id,
          name: data.name ?? 'Barber',
          email: data.email ?? '',
          role: 'BARBER',
          phone: data.phone ?? '',
          active: data.active ?? true,
          createdAt: data.createdAt ?? new Date().toISOString(),
          specialties: data.specialties ?? [],
          commissionRate: data.commissionRate,
          notes: data.notes ?? '',
        };
      });
      if (barbers.length) await cache(barbers);
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached barbers.', error);
    }
  }

  if (!barbers.length) {
    barbers = await readJson<AppUser[]>(STORAGE_KEYS.cachedBarbers, []);
  }

  if (!barbers.length) {
    // Seed initial staff
    barbers = [...DEFAULT_BARBERS];
    await cache(barbers);
  }

  const sorted = [...barbers].sort((a, b) => a.name.localeCompare(b.name));
  return includeInactive ? sorted : sorted.filter((b) => b.active !== false);
}

/**
 * Creates or updates a barber profile.
 * When adding a new barber and Firebase is online, uses a temporary secondary
 * Firebase App instance to register the auth credentials so the current admin
 * stays securely logged in!
 */
export async function saveBarber(
  input: BarberInput,
  existingId?: string
): Promise<AppUser> {
  const cached = await readJson<AppUser[]>(STORAGE_KEYS.cachedBarbers, []);
  const existing = existingId ? cached.find((b) => b.id === existingId) : undefined;

  let assignedId = existingId;

  // If new barber and Firebase is configured, create the Firebase Auth account
  if (!assignedId && isFirebaseConfigured && (await isOnline()) && input.password) {
    try {
      const secondaryName = `BarberAuth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryName);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        input.email.trim().toLowerCase(),
        input.password
      );
      assignedId = cred.user.uid;
      await deleteApp(secondaryApp);
    } catch (error: unknown) {
      console.warn('[BarberSync] Could not register barber in Firebase Auth. Saving profile with local ID.', error);
    }
  }

  const id = assignedId ?? existing?.id ?? createLocalId('barber');
  const barber: AppUser = {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: 'BARBER',
    phone: input.phone?.trim() ?? '',
    active: input.active !== undefined ? input.active : true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    specialties: input.specialties ?? [],
    commissionRate: input.commissionRate,
    notes: input.notes?.trim() ?? '',
  };

  const next = existingId
    ? cached.map((b) => (b.id === existingId ? barber : b))
    : [...cached, barber];

  await cache(next);

  // Sync to Firestore users collection
  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.users, barber.id), barber, { merge: true });
    } catch (error) {
      console.warn('[BarberSync] Could not save barber remotely.', error);
    }
  }

  return barber;
}

/** Toggles or sets a barber's active state. */
export async function setBarberActive(id: string, active: boolean): Promise<void> {
  const cached = await readJson<AppUser[]>(STORAGE_KEYS.cachedBarbers, []);
  await cache(cached.map((b) => (b.id === id ? { ...b, active } : b)));

  if (firestore && (await isOnline())) {
    try {
      await updateDoc(doc(firestore, COLLECTIONS.users, id), { active });
    } catch (error) {
      console.warn('[BarberSync] Could not update barber active state remotely.', error);
    }
  }
}

/**
 * Checks whether a barber has recorded transactions.
 */
export async function barberHasTransactions(id: string): Promise<boolean> {
  const cachedTransactions = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
  const inCache = cachedTransactions.some((t) => t.barberId === id);
  if (inCache) return true;

  if (firestore && (await isOnline())) {
    try {
      const q = query(
        collection(firestore, COLLECTIONS.transactions),
        where('barberId', '==', id)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Deletes a barber profile.
 */
export async function deleteBarber(id: string): Promise<void> {
  const cached = await readJson<AppUser[]>(STORAGE_KEYS.cachedBarbers, []);
  await cache(cached.filter((b) => b.id !== id));

  if (firestore && (await isOnline())) {
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.users, id));
    } catch (error) {
      console.warn('[BarberSync] Could not delete barber remotely.', error);
    }
  }
}

export async function replaceCachedBarbers(barbers: AppUser[]): Promise<void> {
  await cache(barbers);
}

