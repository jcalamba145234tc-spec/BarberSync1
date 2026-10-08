import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type UpdateData,
  where,
  limit as fsLimit,
} from 'firebase/firestore';
import { COLLECTIONS, STORAGE_KEYS } from '../constants/config';
import { AppUser } from '../types/auth';
import { ShopSettings } from '../types/report';
import {
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionStatus,
} from '../types/transaction';
import { calculateRevenueSplit, resolveSplitPercentage, round2 } from '../utils/calculations';
import { isWithinRange } from '../utils/dateUtils';
import { firestore } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';
import { enqueueOp } from './pendingOps';
import { getGcashScreenshotBase64 } from './storageService';

/**
 * TRANSACTIONS: READ / WRITE PATTERN
 * -----------------------------------
 * READS (getTransactions): one-time Firestore reads via getDocs(), not a live
 * onSnapshot() listener. A screen only sees fresh data when it re-fetches
 * (on focus, or pull-to-refresh) - another device's changes don't appear here
 * automatically. On success the result is cached to AsyncStorage; on failure
 * (offline, or a permissions error) the last cached copy is returned instead.
 *
 * WRITES (pushTransaction / pushOrQueueUpdate): every write uses setDoc() with
 * an ID generated on the device (see createLocalId in localStore.ts), not
 * addDoc() with a Firestore-generated ID. That is what makes retries safe -
 * re-sending the same transaction overwrites the same document instead of
 * creating a duplicate. New transactions always pass { merge: true } and stamp
 * serverCreatedAt with Firestore's own clock (serverTimestamp()), so a phone
 * with a wrong or deliberately changed date/time cannot backdate a sale - this
 * is also checked server-side in firestore.rules.
 *
 * OFFLINE: if a write can't reach Firestore, it is NOT dropped. New
 * transactions go to the pending-transactions queue (queueForSync); edits to
 * existing transactions go to the pending-ops queue (pendingOps.ts). Both
 * queues are replayed by syncService.ts once the connection returns.
 */

/** The signed-in profile, used to scope reads the way the security rules do. */
async function currentUser(): Promise<AppUser | null> {
  return readJson<AppUser | null>(STORAGE_KEYS.cachedUser, null);
}

/** Builds the transaction object, including the automatic revenue split. */
export function buildTransaction(input: TransactionInput, settings: ShopSettings | null): Transaction {
  const { shopShare, barberShare } = calculateRevenueSplit(
    input.amount,
    resolveSplitPercentage(settings)
  );
  const isGcash = input.paymentMethod === 'GCASH';
  // Only the admin/owner records sales (at the counter, with the customer's GCash
  // receipt in front of them), so a GCash payment is verified at entry time.
  // The reference number stays required as the audit trail.
  const status: TransactionStatus = 'COMPLETED';
  return {
    id: createLocalId('txn'),
    customerName: input.customerName.trim(),
    barberId: input.barberId,
    barberName: input.barberName,
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    amount: input.amount,
    shopShare,
    barberShare,
    tip: input.tip && Number.isFinite(input.tip) && input.tip > 0 ? round2(input.tip) : 0,
    paymentMethod: input.paymentMethod,
    gcashReference: isGcash ? (input.gcashReference ?? '').trim() || null : null,
    gcashScreenshotUrl: null,
    gcashScreenshotBase64: isGcash ? input.gcashScreenshotBase64 ?? null : null,
    gcashScreenshotLocalUri: isGcash ? input.gcashScreenshotLocalUri ?? null : null,
    gcashVerified: isGcash,
    status,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    synced: false,
  };
}

async function cacheTransactions(transactions: Transaction[]): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedTransactions, transactions.slice(0, 500));
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  return readJson<Transaction[]>(STORAGE_KEYS.pendingTransactions, []);
}

export async function setPendingTransactions(transactions: Transaction[]): Promise<void> {
  await writeJson(STORAGE_KEYS.pendingTransactions, transactions);
}

async function queueForSync(transaction: Transaction): Promise<void> {
  const pending = await getPendingTransactions();
  // The local id is reused as the Firestore document id, so re-queuing the same
  // transaction can never create a duplicate record.
  const withoutDuplicate = pending.filter((t) => t.id !== transaction.id);
  await setPendingTransactions([...withoutDuplicate, transaction]);
}

/** Writes one transaction to Firestore using its local id (idempotent). */
export async function pushTransaction(transaction: Transaction): Promise<Transaction> {
  if (!firestore) throw new Error('Firestore is not configured.');
  const payload: Transaction = {
    ...transaction,
    synced: true,
  };
  // The local device URI never leaves the phone.
  const { gcashScreenshotLocalUri: _localUri, ...remote } = payload;
  // serverCreatedAt is stamped by Firestore itself, so a device with a wrong or
  // deliberately changed clock cannot backdate a sale (enforced in the rules).
  await setDoc(
    doc(firestore, COLLECTIONS.transactions, transaction.id),
    { ...remote, serverCreatedAt: serverTimestamp() },
    { merge: true }
  );
  return payload;
}

/**
 * Saves a transaction. Works online and offline:
 * offline it is stored locally and marked unsynced, then pushed automatically later.
 */
export async function createTransaction(
  input: TransactionInput,
  settings: ShopSettings | null
): Promise<Transaction> {
  const transaction = buildTransaction(input, settings);
  const online = await isOnline();

  let saved = transaction;
  if (online && firestore) {
    try {
      saved = await pushTransaction(transaction);
    } catch (error) {
      console.warn('[BarberSync] Online save failed, queued for sync.', error);
      await queueForSync(transaction);
    }
  } else if (firestore) {
    // Only worth queueing when a Firebase backend actually exists to sync to.
    await queueForSync(transaction);
  }

  const cached = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
  await cacheTransactions([saved, ...cached.filter((t) => t.id !== saved.id)]);
  return saved;
}

function mergeById(remote: Transaction[], pending: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  remote.forEach((t) => map.set(t.id, t));
  pending.forEach((t) => {
    if (!map.has(t.id)) map.set(t.id, t);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Loads transactions, remotely when possible and from cache when offline. */
export async function getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  let base: Transaction[] = [];
  const online = await isOnline();

  if (online && firestore) {
    try {
      // A barber may only read their own rows. Firestore rejects any query it
      // cannot prove is allowed, so the barberId filter has to be part of the
      // query itself - without it every barber got permission-denied and
      // silently fell back to a stale cache.
      const user = await currentUser();
      const transactionsRef = collection(firestore, COLLECTIONS.transactions);
      const scoped =
        user && user.role !== 'ADMIN'
          ? query(
              transactionsRef,
              where('barberId', '==', user.id),
              orderBy('createdAt', 'desc'),
              fsLimit(500)
            )
          : query(transactionsRef, orderBy('createdAt', 'desc'), fsLimit(500));
      const snapshot = await getDocs(scoped);
      base = snapshot.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }));
      await cacheTransactions(base);
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached transactions.', error);
      base = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
    }
  } else {
    base = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
  }

  const pending = await getPendingTransactions();
  return applyFilters(mergeById(base, pending), filters);
}

export function applyFilters(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter((t) => {
    if (filters.from && filters.to && !isWithinRange(t.createdAt, filters.from, filters.to)) return false;
    if (filters.barberId && t.barberId !== filters.barberId) return false;
    if (filters.paymentMethod && t.paymentMethod !== filters.paymentMethod) return false;
    if (filters.status && t.status !== filters.status) return false;
    return true;
  });
}

async function updateLocal(id: string, changes: Partial<Transaction>): Promise<void> {
  const cached = await readJson<Transaction[]>(STORAGE_KEYS.cachedTransactions, []);
  await cacheTransactions(cached.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  const pending = await getPendingTransactions();
  if (pending.some((t) => t.id === id)) {
    await setPendingTransactions(pending.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }
}

/**
 * Applies an edit remotely, or queues it when offline / on failure.
 * Previously a failed write was only logged, so the change was lost for good.
 */
async function pushOrQueueUpdate(id: string, changes: Record<string, unknown>): Promise<void> {
  if (firestore && (await isOnline())) {
    try {
      await updateDoc(
        doc(firestore, COLLECTIONS.transactions, id),
        changes as UpdateData<DocumentData>
      );
      return;
    } catch (error) {
      console.warn('[BarberSync] Remote update failed, queued for sync.', error);
    }
  }
  await enqueueOp({
    kind: 'transactionUpdate',
    id,
    changes,
    queuedAt: new Date().toISOString(),
  });
}

/** Admin action: approve or reject a GCash payment. */
export async function setGcashVerification(id: string, verified: boolean): Promise<void> {
  const changes: Partial<Transaction> = {
    gcashVerified: verified,
    status: verified ? 'COMPLETED' : 'CANCELLED',
  };
  await updateLocal(id, changes);
  await pushOrQueueUpdate(id, changes as Record<string, unknown>);
}

export async function cancelTransaction(id: string): Promise<void> {
  await updateLocal(id, { status: 'CANCELLED' });
  await pushOrQueueUpdate(id, { status: 'CANCELLED' });
}

/** Replaces the whole local cache. Used by the demo data seeder. */
export async function replaceCachedTransactions(transactions: Transaction[]): Promise<void> {
  await cacheTransactions(transactions);
}
