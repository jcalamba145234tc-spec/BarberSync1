import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { COLLECTIONS, STORAGE_KEYS } from '../constants/config';
import { QueueEntry, QueueInput, QueueStatus } from '../types/queue';
import { BarberService } from '../types/service';
import { isToday } from '../utils/dateUtils';
import { firestore } from './firebase';
import { createLocalId, readJson, writeJson } from './localStore';
import { isOnline } from './networkService';
import { enqueueOp } from './pendingOps';

const ACTIVE_STATUSES: QueueStatus[] = ['WAITING', 'CALLED', 'IN_SERVICE'];

async function cache(entries: QueueEntry[]): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedQueue, entries);
}

async function localQueue(): Promise<QueueEntry[]> {
  return readJson<QueueEntry[]>(STORAGE_KEYS.cachedQueue, []);
}

export function isActive(entry: QueueEntry): boolean {
  return ACTIVE_STATUSES.includes(entry.status);
}

/**
 * Recomputes the estimated wait for everyone still waiting:
 * a customer waits for the total duration of everyone ahead of them.
 */
export function recalculateWaitTimes(entries: QueueEntry[], services: BarberService[]): QueueEntry[] {
  const durationFor = (serviceId: string) =>
    services.find((s) => s.id === serviceId)?.durationMinutes ?? 20;

  let cumulative = 0;
  return entries
    .slice()
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
    .map((entry) => {
      if (!isActive(entry)) return entry;
      const estimated = cumulative;
      cumulative += durationFor(entry.serviceId);
      return { ...entry, estimatedWaitTime: estimated };
    });
}

export async function getQueue(services: BarberService[] = []): Promise<QueueEntry[]> {
  let entries: QueueEntry[] = [];
  if (firestore && (await isOnline())) {
    try {
      const snapshot = await getDocs(collection(firestore, COLLECTIONS.queue));
      entries = snapshot.docs.map((d) => ({ ...(d.data() as QueueEntry), id: d.id }));
      await cache(entries);
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached queue.', error);
      entries = await localQueue();
    }
  } else {
    entries = await localQueue();
  }
  const todays = entries.filter((e) => isToday(e.arrivalTime));
  return recalculateWaitTimes(todays, services);
}

/** Writes remotely, or queues the change so it is never silently lost. */
async function pushOrQueueEntry(id: string, changes: Record<string, unknown>): Promise<void> {
  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.queue, id), changes, { merge: true });
      return;
    } catch (error) {
      console.warn('[BarberSync] Queue write failed, queued for sync.', error);
    }
  }
  await enqueueOp({ kind: 'queueUpsert', id, changes, queuedAt: new Date().toISOString() });
}

export async function addToQueue(input: QueueInput): Promise<QueueEntry> {
  const entry: QueueEntry = {
    id: createLocalId('que'),
    customerName: input.customerName.trim(),
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    barberId: input.barberId,
    barberName: input.barberName,
    status: 'WAITING',
    arrivalTime: new Date().toISOString(),
    estimatedWaitTime: 0,
    startedAt: null,
    completedAt: null,
  };
  const entries = await localQueue();
  await cache([...entries, entry]);
  await pushOrQueueEntry(entry.id, entry as unknown as Record<string, unknown>);
  return entry;
}

export async function updateQueueStatus(id: string, status: QueueStatus): Promise<void> {
  const now = new Date().toISOString();
  const changes: Partial<QueueEntry> = { status };
  if (status === 'IN_SERVICE') changes.startedAt = now;
  if (status === 'COMPLETED' || status === 'CANCELLED') changes.completedAt = now;

  const entries = await localQueue();
  await cache(entries.map((e) => (e.id === id ? { ...e, ...changes } : e)));

  await pushOrQueueEntry(id, changes as Record<string, unknown>);
}

export async function replaceCachedQueue(entries: QueueEntry[]): Promise<void> {
  await cache(entries);
}
