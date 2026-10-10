/**
 * LIVE TRANSACTIONS FOR ONE BARBER
 * ---------------------------------
 * Same idea as subscribeToQueue in queueService.ts: a Firestore onSnapshot()
 * listener instead of a one-time read. When the owner completes a customer and
 * records the service, the new transaction reaches this barber's phone right
 * away - commission, "services today" and the services list all update without
 * a refresh.
 *
 * Scoped to one barber on purpose: the query carries where('barberId', '==',
 * uid), which is exactly what firestore.rules require for a barber to read
 * (a barber can never listen to anyone else's transactions). Together with the
 * createdAt range and ordering it uses the barberId + createdAt composite
 * index that is already declared in firestore.indexes.json.
 *
 * Does nothing when Firestore is not configured (local/demo mode); the caller
 * keeps using its one-time fetch there.
 */
import { collection, limit as fsLimit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/config';
import { Transaction } from '../types/transaction';
import { rowsFromSnapshot } from '../utils/snapshots';
import { firestore } from './firebase';

/** Safety cap for one barber's rows in one range (a month is far below this). */
const LIVE_LIMIT = 1000;

export interface BarberTransactionRange {
  barberId: string;
  /** ISO timestamps, inclusive. */
  from: string;
  to: string;
}

/** Returns an unsubscribe function - call it when the screen goes away. */
export function subscribeToBarberTransactions(
  range: BarberTransactionRange,
  onChange: (transactions: Transaction[]) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!firestore) return () => {};
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (!range.barberId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return () => {};
  }

  const scoped = query(
    collection(firestore, COLLECTIONS.transactions),
    where('barberId', '==', range.barberId),
    where('createdAt', '>=', from.toISOString()),
    where('createdAt', '<=', to.toISOString()),
    orderBy('createdAt', 'desc'),
    fsLimit(LIVE_LIMIT)
  );

  return onSnapshot(
    scoped,
    (snapshot) => {
      const rows = rowsFromSnapshot<Transaction>(snapshot);
      if (rows) onChange(rows);
    },
    (error) => {
      console.warn('[BarberSync] Live transactions listener errored.', error);
      onError?.(error);
    }
  );
}
