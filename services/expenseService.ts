import { collection, deleteDoc, doc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/config';
import { Expense, ExpenseInput } from '../types/expense';
import { isWithinRange } from '../utils/dateUtils';
import { firestore } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';
import { enqueueOp } from './pendingOps';

/**
 * EXPENSES: READ / WRITE PATTERN
 * -------------------------------
 * Admin-only collection (enforced in firestore.rules, not just in the UI).
 * This fallback helper uses getDocs(); screens use liveData.ts listeners.
 * One-time reads are cached locally on success and read
 * back from that cache on failure or when offline - same pattern as every
 * other service in this app, so reports still show a number instead of a
 * blank screen with no connection.
 * WRITES use setDoc(..., { merge: true }) with a device-generated ID, so a
 * retried save can never create a duplicate expense row.
 */
const CACHE_KEY = '@barbersync/cached-expenses';

async function cache(expenses: Expense[]): Promise<void> {
  await writeJson(CACHE_KEY, expenses);
}

export async function getExpenses(from?: string, to?: string, cacheOnly = false): Promise<Expense[]> {
  let expenses: Expense[] = [];
  if (!cacheOnly && firestore && (await isOnline())) {
    try {
      const ref = collection(firestore, COLLECTIONS.expenses);
      const snapshot = await getDocs(from && to ? query(ref, where('date', '>=', from), where('date', '<=', to)) : ref);
      expenses = snapshot.docs.map((d) => ({ ...(d.data() as Expense), id: d.id }));
      const old = await readJson<Expense[]>(CACHE_KEY, []);
      await cache(from && to ? [...old.filter((e) => !isWithinRange(e.date, from, to)), ...expenses] : expenses);
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached expenses.', error);
      expenses = await readJson<Expense[]>(CACHE_KEY, []);
    }
  } else {
    expenses = await readJson<Expense[]>(CACHE_KEY, []);
  }
  const filtered = from && to ? expenses.filter((e) => isWithinRange(e.date, from, to)) : expenses;
  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveExpense(input: ExpenseInput, existingId?: string): Promise<Expense> {
  // ...input is spread first so a stray field on the input can never overwrite
  // the generated id or createdAt.
  const expense: Expense = {
    ...input,
    id: existingId ?? createLocalId('exp'),
    createdAt: new Date().toISOString(),
  };
  const cached = await readJson<Expense[]>(CACHE_KEY, []);
  const next = existingId
    ? cached.map((e) => (e.id === existingId ? { ...e, ...input } : e))
    : [...cached, expense];
  await cache(next);

  const payload = expense as unknown as Record<string, unknown>;
  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.expenses, expense.id), payload, { merge: true });
      return expense;
    } catch (error) {
      console.warn('[BarberSync] Expense save failed, queued for sync.', error);
    }
  }
  await enqueueOp({
    kind: 'expenseSave',
    id: expense.id,
    changes: payload,
    queuedAt: new Date().toISOString(),
  });
  return expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const cached = await readJson<Expense[]>(CACHE_KEY, []);
  await cache(cached.filter((e) => e.id !== id));
  if (firestore && (await isOnline())) {
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.expenses, id));
      return;
    } catch (error) {
      console.warn('[BarberSync] Expense delete failed, queued for sync.', error);
    }
  }
  await enqueueOp({ kind: 'expenseDelete', id, queuedAt: new Date().toISOString() });
}

export async function replaceCachedExpenses(expenses: Expense[]): Promise<void> {
  await cache(expenses);
}

let liveCacheWrites: Promise<void> = Promise.resolve();
export function cacheLiveExpenses(rows: Expense[], from?: string, to?: string): Promise<void> {
  const write = liveCacheWrites.catch(() => {}).then(async () => {
    const old = await readJson<Expense[]>(CACHE_KEY, []);
    await cache(from && to ? [...old.filter((e) => !isWithinRange(e.date, from, to)), ...rows] : rows);
  });
  liveCacheWrites = write;
  return write;
}
