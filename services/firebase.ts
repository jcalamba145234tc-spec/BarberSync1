import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

/**
 * Firebase configuration is read from environment variables (.env).
 * Copy .env.example to .env and paste the values from your Firebase console.
 * Nothing is hardcoded, so no credentials ever land in git.
 */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/**
 * True only when every required value is present.
 * When false the app runs in LOCAL MODE: everything still works, but data is
 * stored on the device with AsyncStorage instead of Firebase. This lets the
 * project be demonstrated in class before Firebase is configured.
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.authDomain
);

/**
 * Firebase exposes getReactNativePersistence only in its React Native build and the
 * export is missing from some type definitions, so it is resolved defensively.
 * Without it, Auth falls back to memory persistence.
 */
function reactNativePersistence(): { persistence: Persistence } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authModule = require('firebase/auth') as {
      getReactNativePersistence?: (storage: unknown) => Persistence;
    };
    if (typeof authModule.getReactNativePersistence !== 'function') return null;
    return { persistence: authModule.getReactNativePersistence(AsyncStorage) };
  } catch {
    return null;
  }
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      // Keeps the Firebase session signed in between app restarts.
      authInstance = initializeAuth(app, reactNativePersistence() ?? undefined);
    } catch {
      // initializeAuth throws if it already ran (e.g. after a fast refresh).
      authInstance = getAuth(app);
    }
    dbInstance = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    // Storage is optional (it needs the Blaze plan). If it is unavailable the
    // app still works: GCash screenshots simply stay on the device and only the
    // reference number is synced. Guarded separately so a missing bucket can
    // never take Firestore down with it.
    if (firebaseConfig.storageBucket) {
      try {
        storageInstance = getStorage(app);
      } catch (storageError) {
        console.warn('[BarberSync] Storage unavailable, screenshots stay local.', storageError);
        storageInstance = null;
      }
    }
  } catch (error) {
    console.warn('[BarberSync] Firebase failed to initialize, falling back to local mode.', error);
    app = null;
    authInstance = null;
    dbInstance = null;
    storageInstance = null;
  }
}

export const firebaseApp = app;
export const firebaseAuth = authInstance;
export const firestore = dbInstance;
export const firebaseStorage = storageInstance;

/** True when Firebase is ready to be used for reads/writes. */
export function firebaseReady(): boolean {
  return Boolean(firestore && firebaseAuth);
}