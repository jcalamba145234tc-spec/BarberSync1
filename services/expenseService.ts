import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/config';
import { Expense, ExpenseInput } from '../types/expense';
import { isWithinRange } from '../utils/dateUtils';
import { firestore } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';
import { enqueueOp } from './pendingOps';

const CACHE_KEY = '@barbersync/cached-expenses';

async function cache(expenses: Expense[]): Promise<void> {
  await writeJson(CACHE_KEY, expenses);
}

export async function getExpenses(from?: string, to?: string): Promise<Expense[]> {
  let expenses: Expense[] = [];
  if (firestore && (await isOnline())) {
    try {
      const snapshot = await getDocs(collection(firestore, COLLECTIONS.expenses));
      expenses = snapshot.docs.map((d) => ({ ...(d.data() as Expense), id: d.id }));
      await cache(expenses);
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
