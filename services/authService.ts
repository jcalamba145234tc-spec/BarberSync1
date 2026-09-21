import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS, DEMO_ACCOUNTS, STORAGE_KEYS } from '../constants/config';
import { AppUser, UserRole } from '../types/auth';
import { firebaseAuth, firestore, isFirebaseConfigured } from './firebase';
import { readJson, remove, writeJson } from './localStore';

export class AuthError extends Error {}

/** Turns raw Firebase auth error codes into friendly messages. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the shop owner.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your network and try again.';
    case 'auth/weak-password':
      return 'That password is too weak. Use at least 6 characters.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign out and sign in again before changing your password.';
    case 'auth/missing-email':
      return 'Please enter the email address of your account.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Something went wrong while signing in.';
  }
}

function demoUserFor(email: string): AppUser | null {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  if (normalized === DEMO_ACCOUNTS.admin.email) {
    return {
      id: 'demo-admin',
      name: DEMO_ACCOUNTS.admin.name,
      email: normalized,
      role: 'ADMIN',
      phone: '09171234567',
      active: true,
      createdAt: now,
    };
  }
  const barberIndex = DEMO_ACCOUNTS.barbers.findIndex((b) => b.email === normalized);
  if (barberIndex >= 0) {
    return {
      id: `demo-barber-${barberIndex + 1}`,
      name: DEMO_ACCOUNTS.barbers[barberIndex].name,
      email: normalized,
      role: 'BARBER',
      phone: '09181234567',
      active: true,
      createdAt: now,
    };
  }
  return null;
}

/** Reads the user profile document that holds the role. */
export async function loadUserProfile(uid: string, email: string): Promise<AppUser> {
  if (!firestore) throw new AuthError('Firebase is not configured.');
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.users, uid));
  if (!snapshot.exists()) {
    throw new AuthError(
      'Your account has no profile record yet. Ask the shop owner to add you in the users collection.'
    );
  }
  const data = snapshot.data() as Partial<AppUser>;
  if (data.active === false) throw new AuthError('This account is inactive.');
  return {
    id: uid,
    name: data.name ?? email,
    email: data.email ?? email,
    role: (data.role as UserRole) ?? 'BARBER',
    phone: data.phone ?? '',
    active: data.active ?? true,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (isFirebaseConfigured && firebaseAuth) {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const profile = await loadUserProfile(credential.user.uid, credential.user.email ?? email);
    await writeJson(STORAGE_KEYS.cachedUser, profile);
    return profile;
  }

  // LOCAL MODE (no Firebase credentials yet): only the documented demo accounts
  // work. This accepts any 6+ character password, so it must never be reachable
  // in a release build - a missing .env would otherwise ship a backdoor.
  if (!__DEV__) {
    throw new AuthError(
      'Sign-in is unavailable because Firebase is not configured for this build.'
    );
  }
  const demoUser = demoUserFor(email);
  if (!demoUser || password.length < 6) {
    throw new AuthError(
      'Local mode only accepts the demo accounts (password: any 6+ characters). Configure Firebase in .env for real accounts.'
    );
  }
  await writeJson(STORAGE_KEYS.cachedUser, demoUser);
  return demoUser;
}

export async function signOut(): Promise<void> {
  if (isFirebaseConfigured && firebaseAuth) {
    await firebaseSignOut(firebaseAuth);
  }
  await remove(STORAGE_KEYS.cachedUser);
}

/** Restores the session on app start (works offline thanks to the cached profile). */
export async function restoreSession(): Promise<AppUser | null> {
  const cached = await readJson<AppUser | null>(STORAGE_KEYS.cachedUser, null);
  if (!isFirebaseConfigured || !firebaseAuth) return cached;

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth!, async (firebaseUser) => {
      unsubscribe();
      if (!firebaseUser) {
        resolve(null);
        return;
      }
      try {
        const profile = await loadUserProfile(firebaseUser.uid, firebaseUser.email ?? '');
        await writeJson(STORAGE_KEYS.cachedUser, profile);
        resolve(profile);
      } catch {
        resolve(cached);
      }
    });
  });
}

/** Barber list used by transaction entry and report filters. */
export async function listBarbers(): Promise<AppUser[]> {
  if (firestore) {
    try {
      const q = query(collection(firestore, COLLECTIONS.users), where('role', '==', 'BARBER'));
      const snapshot = await getDocs(q);
      const barbers = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AppUser[];
      if (barbers.length) return barbers.filter((b) => b.active !== false);
    } catch (error) {
      console.warn('[BarberSync] Could not load barbers from Firestore.', error);
    }
  }
  return DEMO_ACCOUNTS.barbers.map((barber, index) => ({
    id: `demo-barber-${index + 1}`,
    name: barber.name,
    email: barber.email,
    role: 'BARBER' as UserRole,
    phone: '',
    active: true,
    createdAt: new Date().toISOString(),
  }));
}

/** Creates or updates the Firestore profile for a user (admin tooling). */
export async function upsertUserProfile(user: AppUser): Promise<void> {
  if (!firestore) return;
  await setDoc(doc(firestore, COLLECTIONS.users, user.id), user, { merge: true });
}


/**
 * Sends a password reset email. Firebase hosts the reset page, so no extra
 * backend is needed. Always resolves the same way whether or not the address
 * exists, so the screen cannot be used to discover which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new AuthError(
      'Password reset needs Firebase. In local mode, demo accounts accept any 6+ character password.'
    );
  }
  try {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    // Do not leak whether the account exists.
    if (code === 'auth/user-not-found') return;
    throw error;
  }
}

/**
 * Changes the signed-in user's password.
 * Firebase requires a recent login for this, so the current password is
 * re-checked first; that also stops someone changing the password on a phone
 * that was left unlocked.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new AuthError('Changing your password needs Firebase to be configured.');
  }
  const current = firebaseAuth.currentUser;
  if (!current || !current.email) {
    throw new AuthError('You need to sign in again before changing your password.');
  }
  const credential = EmailAuthProvider.credential(current.email, currentPassword);
  await reauthenticateWithCredential(current, credential);
  await updatePassword(current, newPassword);
}
