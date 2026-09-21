import {
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { COLLECTIONS } from '../constants/config';
import { firestore } from './firebase';
import { isOnline } from './networkService';
import { readJson, writeJson } from './localStore';

/**
 * Offline queue for EDITS (new transactions have their own queue).
 *
 * Before, when a remote update failed the change was written to the local cache
 * and the error was only logged, so the phone and Firestore drifted apart
 * permanently. Every failed edit is now queued here and replayed on next sync.
 */
export const PENDING_OPS_KEY = '@barbersync/pending-ops';

export type PendingOp =
  | { kind: 'transactionUpdate'; id: string; changes: Record<string, unknown>; queuedAt: string }
  | { kind: 'queueUpsert'; id: string; changes: Record<string, unknown>; queuedAt: string }
  | { kind: 'expenseSave'; id: string; changes: Record<string, unknown>; queuedAt: string }
  | { kind: 'expenseDelete'; id: string; queuedAt: string };

export async function getPendingOps(): Promise<PendingOp[]> {
  return readJson<PendingOp[]>(PENDING_OPS_KEY, []);
}

export async function setPendingOps(ops: PendingOp[]): Promise<void> {
  await writeJson(PENDING_OPS_KEY, ops);
}

/** Queues an edit. Repeated edits to the same doc merge, so replay is idempotent. */
export async function enqueueOp(op: PendingOp): Promise<void> {
  // Local mode (no Firebase): the device cache IS the source of truth, so there
  // is nothing to replay later. Queueing here would grow a pending counter that
  // can never be drained, because flushPendingOps() requires Firestore.
  if (!firestore) return;

  const ops = await getPendingOps();
  const index = ops.findIndex((o) => o.kind === op.kind && o.id === op.id);
  if (index === -1) {
    await setPendingOps([...ops, op]);
    return;
  }
  const existing = ops[index];
  const merged: PendingOp =
    'changes' in existing && 'changes' in op
      ? { ...existing, changes: { ...existing.changes, ...op.changes }, queuedAt: op.queuedAt }
      : op;
  const next = ops.slice();
  next[index] = merged;
  await setPendingOps(next);
}

async function runOp(op: PendingOp, skipTransactionIds: Set<string>): Promise<void> {
  if (!firestore) throw new Error('Firestore is not configured.');
  switch (op.kind) {
    case 'transactionUpdate':
      // Not uploaded yet: the queued transaction already carries these changes.
      if (skipTransactionIds.has(op.id)) return;
      await updateDoc(
        doc(firestore, COLLECTIONS.transactions, op.id),
        op.changes as UpdateData<DocumentData>
      );
      return;
    case 'queueUpsert':
      await setDoc(doc(firestore, COLLECTIONS.queue, op.id), op.changes, { merge: true });
      return;
    case 'expenseSave':
      await setDoc(doc(firestore, COLLECTIONS.expenses, op.id), op.changes, { merge: true });
      return;
    case 'expenseDelete':
      await deleteDoc(doc(firestore, COLLECTIONS.expenses, op.id));
      return;
  }
}

export interface FlushResult {
  flushed: number;
  remaining: number;
}

/** Replays every queued edit. Anything that still fails stays queued. */
export async function flushPendingOps(
  skipTransactionIds: Set<string> = new Set()
): Promise<FlushResult> {
  const ops = await getPendingOps();
  if (!ops.length) return { flushed: 0, remaining: 0 };
  if (!firestore || !(await isOnline())) return { flushed: 0, remaining: ops.length };

  const stillPending: PendingOp[] = [];
  let flushed = 0;

  for (const op of ops) {
    try {
      await runOp(op, skipTransactionIds);
      flushed += 1;
    } catch (error) {
      console.warn('[BarberSync] Could not replay a queued edit, keeping it.', error);
      stillPending.push(op);
    }
  }

  await setPendingOps(stillPending);
  return { flushed, remaining: stillPending.length };
}

export async function pendingOpsCount(): Promise<number> {
  if (!firestore) return 0;
  return (await getPendingOps()).length;
}