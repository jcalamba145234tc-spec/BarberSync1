import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, DEFAULT_SETTINGS, SETTINGS_DOC_ID, STORAGE_KEYS } from '../constants/config';
import { AppUser } from '../types/auth';
import { DailyAttendance } from '../types/attendance';
import { Expense } from '../types/expense';
import { ShopSettings } from '../types/report';
import { BarberService } from '../types/service';
import { createSubscriptionPool } from '../utils/sharedSubscription';
import { rowsFromSnapshot } from '../utils/snapshots';
import { cacheLiveExpenses } from './expenseService';
import { firestore } from './firebase';
import { writeJson } from './localStore';
import { reconcileAttendance, cacheLiveAttendance } from './attendanceService';

const expensesPool = createSubscriptionPool<Expense[]>();
const attendancePool = createSubscriptionPool<DailyAttendance | null>();

export function subscribeExpenses(userId: string, from: string | undefined, to: string | undefined,
  next: (rows: Expense[]) => void, error: (error: unknown) => void) {
  if (!firestore) return () => {};
  const ref = collection(firestore, COLLECTIONS.expenses);
  const scoped = from && to ? query(ref, where('date', '>=', from), where('date', '<=', to)) : ref;
  return expensesPool(JSON.stringify([userId, from, to]), (emit, fail) => onSnapshot(scoped,
    { includeMetadataChanges: true }, (snap) => {
      const rows = rowsFromSnapshot<Expense>(snap);
      if (rows) {
        emit(rows.sort((a, b) => b.date.localeCompare(a.date)));
        void cacheLiveExpenses(rows, from, to).catch(fail);
      }
    }, fail), next, error);
}

export function subscribeAttendance(userId: string, date: string, barbers: AppUser[],
  next: (day: DailyAttendance) => void, error: (error: unknown) => void) {
  if (!firestore) return () => {};
  return attendancePool(JSON.stringify([userId, date]), (emit, fail) => onSnapshot(
    doc(firestore!, COLLECTIONS.attendance, date), { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache) return;
      const day = snap.exists() ? snap.data() as DailyAttendance : null;
      emit(day);
      void cacheLiveAttendance(date, day).catch(fail);
    }, fail), (day) => next(reconcileAttendance(date, barbers, day)), error);
}

/** App-wide listeners: only the admin can list staff. Clean up together at logout. */
export function subscribeSharedData(user: AppUser, callbacks: {
  services: (rows: BarberService[]) => void;
  barbers: (rows: AppUser[]) => void;
  settings: (settings: ShopSettings) => void;
  error: (error: unknown) => void;
}) {
  if (!firestore) return () => {};
  const stops = [
    onSnapshot(collection(firestore, COLLECTIONS.services), { includeMetadataChanges: true }, (snap) => {
      const rows = rowsFromSnapshot<BarberService>(snap);
      if (!rows) return;
      rows.sort((a, b) => a.name.localeCompare(b.name));
      callbacks.services(rows);
      void writeJson(STORAGE_KEYS.cachedServices, rows).catch(callbacks.error);
    }, callbacks.error),
    onSnapshot(doc(firestore, COLLECTIONS.settings, SETTINGS_DOC_ID), { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache) return;
      const settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) } as ShopSettings;
      callbacks.settings(settings);
      void writeJson(STORAGE_KEYS.cachedSettings, settings).catch(callbacks.error);
    }, callbacks.error),
  ];
  if (user.role === 'ADMIN') stops.push(onSnapshot(
    query(collection(firestore, COLLECTIONS.users), where('role', '==', 'BARBER')),
    { includeMetadataChanges: true }, (snap) => {
      const rows = rowsFromSnapshot<AppUser>(snap);
      if (!rows) return;
      const normalized = rows.map((b) => ({ ...b, name: b.name ?? 'Barber', active: b.active ?? true }));
      normalized.sort((a, b) => a.name.localeCompare(b.name));
      callbacks.barbers(normalized);
      void writeJson(STORAGE_KEYS.cachedBarbers, normalized).catch(callbacks.error);
    }, callbacks.error));
  return () => stops.forEach((stop) => stop());
}
