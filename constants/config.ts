/**
 * App-wide constants: Firestore collection names (COLLECTIONS, the single
 * source of truth so a typo'd collection name can't silently create a new
 * one), default shop settings, demo account credentials used in local mode,
 * and the AsyncStorage keys used for offline caching.
 */
import { ShopSettings } from '../types/report';

/** Firestore collection names (single source of truth). */
export const COLLECTIONS = {
  users: 'users',
  services: 'services',
  transactions: 'transactions',
  queue: 'queue',
  expenses: 'expenses',
  settings: 'settings',
  attendance: 'attendance',
} as const;

export const SETTINGS_DOC_ID = 'shop';

/** AsyncStorage keys used for offline mode and caching. */
export const STORAGE_KEYS = {
  pendingTransactions: '@barbersync/pending-transactions',
  cachedTransactions: '@barbersync/cached-transactions',
  cachedServices: '@barbersync/cached-services',
  cachedQueue: '@barbersync/cached-queue',
  cachedSettings: '@barbersync/cached-settings',
  cachedUser: '@barbersync/cached-user',
  demoSeeded: '@barbersync/demo-seeded',
  cachedBarbers: '@barbersync/cached-barbers',
  cachedAttendance: '@barbersync/cached-attendance',
} as const;

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Chris Barber Shop',
  shopAddress: '',
  shopContact: '',
  shopPercentage: 0.5,
  barberPercentage: 0.5,
  minimumServicePrice: 150,
  monthlyFixedExpense: 24000,
  notificationsEnabled: true,
  endOfDaySummaryEnabled: true,
};

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@barbersync.test', name: 'Chris (Owner)' },
  barbers: [
    { email: 'barber@barbersync.test', name: 'Juan Dela Cruz' },
    { email: 'barber2@barbersync.test', name: 'Mark Reyes' },
  ],
};

export const EXPENSE_CATEGORIES = ['RENT', 'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'OTHER'] as const;
