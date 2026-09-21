import { Transaction } from '../types/transaction';
import { firestore } from './firebase';
import { isOnline } from './networkService';
import { notifySyncCompleted } from './notificationService';
import {
  getPendingTransactions,
  pushTransaction,
  replaceCachedTransactions,
  setPendingTransactions,
} from './transactionService';
import { flushPendingOps, pendingOpsCount } from './pendingOps';
import { readJson } from './localStore';
import { STORAGE_KEYS } from '../constants/config';

export interface SyncResult {
  synced: number;
  remaining: number;
  /** Queued edits (verifications, cancellations, queue and expense changes). */
  editsFlushed: number;
  skipped: boolean;
  error?: string;
}

let syncing = false;

/**
 * Uploads every transaction that was created while offline.
 * Each record keeps its local id and is written with setDoc(merge),
 * so running the sync twice can never create duplicates.
 */
export async function syncPendingTransactions(): Promise<SyncResult> {
  if (syncing) return { synced: 0, remaining: 0, editsFlushed: 0, skipped: true };
  const pending = await getPendingTransactions();
  const queuedEdits = await pendingOpsCount();
  if (!pending.length && !queuedEdits) {
    return { synced: 0, remaining: 0, editsFlushed: 0, skipped: true };
  }
  if (!firestore) {
    return {
      synced: 0,
      remaining: pending.length + queuedEdits,
      editsFlushed: 0,
      skipped: true,
      error: 'Firebase is not configured.',
    };
  }
  if (!(await isOnline())) {
    return {
      synced: 0,
      remaining: pending.length + queuedEdits,
      editsFlushed: 0,
      skipped: true,
      error: 'Still offline.',
    };
  }

  syncing = true;
  const stillPending: Transaction[] = [];
  const uploaded: Transaction[] = [];

  try {
    for (const transaction of pending) {
      try {
        uploaded.push(await pushTransaction(transaction));
      } catch (error) {
        console.warn('[BarberSync] Could not sync a transaction, keeping it queued.', error);
        stillPending.push(transaction);
      }
    }

    await setPendingTransactions(stillPending);

    if (uploaded.length) {
      const cached = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
      const merged = cached.map((t) => uploaded.find((u) => u.id === t.id) ?? t);
      uploaded.forEach((u) => {
        if (!merged.some((t) => t.id === u.id)) merged.push(u);
      });
      await replaceCachedTransactions(
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      await notifySyncCompleted(uploaded.length);
    }

    // Replay queued edits after the uploads, skipping any transaction that is
    // still only local (it already carries the edit and will be pushed with it).
    const edits = await flushPendingOps(new Set(stillPending.map((t) => t.id)));

    return {
      synced: uploaded.length,
      remaining: stillPending.length + edits.remaining,
      editsFlushed: edits.flushed,
      skipped: false,
    };
  } finally {
    syncing = false;
  }
}

export async function pendingCount(): Promise<number> {
  // Nothing is syncable in local mode, so the badge must stay at zero.
  if (!firestore) return 0;
  const [transactions, edits] = await Promise.all([getPendingTransactions(), pendingOpsCount()]);
  return transactions.length + edits;
}
