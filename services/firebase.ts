/**
 * Initializes the Firebase app/Auth/Firestore instances from .env
 * variables. isFirebaseConfigured is the flag every other service checks
 * before attempting a real Firestore call - when false, the app runs in
 * local-only demo mode instead (see services/demoData.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';

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
 * Native only: the web build has no such export (and does not need it, because
 * getAuth() persists to the browser by itself). Without it on native, Auth falls
 * back to memory persistence.
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

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    if (Platform.OS === 'web') {
      // Browser build: getAuth() already persists the session (IndexedDB, then
      // localStorage), so a page reload keeps the user signed in. Calling
      // initializeAuth() with no persistence here would silently fall back to
      // memory-only and sign everyone out on every reload.
      authInstance = getAuth(app);
    } else {
      const nativePersistence = reactNativePersistence();
      if (!nativePersistence) {
        // Not silent any more: without this, every app restart signs the user out.
        console.warn(
          '[BarberSync] React Native auth persistence is unavailable - the session will not survive an app restart.'
        );
      }
      try {
        // Keeps the Firebase session signed in between app restarts (AsyncStorage).
        authInstance = initializeAuth(app, nativePersistence ?? undefined);
      } catch {
        // initializeAuth throws if it already ran (e.g. after a fast refresh).
        authInstance = getAuth(app);
      }
    }
    dbInstance = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch (error) {
    console.warn('[BarberSync] Firebase failed to initialize, falling back to local mode.', error);
    app = null;
    authInstance = null;
    dbInstance = null;
  }
}

export const firebaseApp = app;
export const firebaseAuth = authInstance;
export const firestore = dbInstance;
/** True when Firebase is ready to be used for reads/writes. */
export function firebaseReady(): boolean {
  return Boolean(firestore && firebaseAuth);
}
