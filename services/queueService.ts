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
const FALLBACK_DURATION_MINUTES = 20;

async function cache(entries: QueueEntry[]): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedQueue, entries);
}

async function localQueue(): Promise<QueueEntry[]> {
  return readJson<QueueEntry[]>(STORAGE_KEYS.cachedQueue, []);
}

export function isActive(entry: QueueEntry): boolean {
  return ACTIVE_STATUSES.includes(entry.status);
}

function minutesBetween(fromIso: string, now: Date): number {
  const started = new Date(fromIso).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((now.getTime() - started) / 60000));
}

/**
 * Recomputes the estimated wait for everyone still in line.
 *
 * A waiting customer waits for whatever is left of the chair in front of them
 * plus the full duration of everyone queued ahead. The customer currently being
 * served only contributes their REMAINING time, so the estimate shrinks as the
 * haircut progresses instead of staying frozen at the full duration.
 */
export function recalculateWaitTimes(
  entries: QueueEntry[],
  services: BarberService[],
  now: Date = new Date()
): QueueEntry[] {
  const durationFor = (serviceId: string) => {
    const minutes = services.find((s) => s.id === serviceId)?.durationMinutes;
    return typeof minutes === 'number' && minutes > 0 ? minutes : FALLBACK_DURATION_MINUTES;
  };

  let cumulative = 0;
  return entries
    .slice()
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
    .map((entry) => {
      if (!isActive(entry)) return entry;
      const total = durationFor(entry.serviceId);

      if (entry.status === 'IN_SERVICE') {
        const elapsed = entry.startedAt ? minutesBetween(entry.startedAt, now) : 0;
        cumulative += Math.max(0, total - elapsed);
        return { ...entry, estimatedWaitTime: 0 };
      }

      const estimated = cumulative;
      cumulative += total;
      return { ...entry, estimatedWaitTime: estimated };
    });
}

export async function getQueue(services: BarberService[] = []): Promise<QueueEntry[]> {
  let entries: QueueEntry[] = [];
  if (firestore && (await isOnline())) {
    try {
      const snapshot = await getDocs(collection(firestore, COLLECTIONS.queue));
      const remote = snapshot.docs.map((d) => ({ ...(d.data() as QueueEntry), id: d.id }));
      const cached = await localQueue();
      const remoteIds = new Set(remote.map((e) => e.id));
      // Keep walk-ins that were added offline and have not been pushed yet.
      entries = [...remote, ...cached.filter((e) => !remoteIds.has(e.id))];
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
