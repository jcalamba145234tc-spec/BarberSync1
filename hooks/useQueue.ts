/**
 * Loads and manages the walk-in queue for a screen - optionally scoped to one
 * barber's own entries. Wraps services/queueService.ts and exposes simple
 * loading/busy state for the UI.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { QueueEntry, QueueInput, QueueStatus } from '../types/queue';
import { BarberService } from '../types/service';
import { addToQueue, getQueue, isActive, updateQueueStatus } from '../services/queueService';

/** Pass a barber id to expose only entries assigned to that barber. */
export function useQueue(services: BarberService[], assignedBarberId?: string) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filterForBarber = useCallback(
    (entries: QueueEntry[]) =>
      assignedBarberId ? entries.filter((entry) => entry.barberId === assignedBarberId) : entries,
    [assignedBarberId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(filterForBarber(await getQueue(services)));
    } finally {
      setLoading(false);
    }
  }, [services, filterForBarber]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        try {
          const entries = await getQueue(services);
          if (mounted) setQueue(filterForBarber(entries));
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [services, filterForBarber])
  );

  const activeQueue = useMemo(() => queue.filter(isActive), [queue]);
  const doneToday = useMemo(() => queue.filter((entry) => !isActive(entry)), [queue]);

  const add = useCallback(
    async (input: QueueInput) => {
      await addToQueue(input);
      await load();
    },
    [load]
  );

  const setStatus = useCallback(
    async (id: string, status: QueueStatus) => {
      setBusyId(id);
      try {
        await updateQueueStatus(id, status);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return { queue, activeQueue, doneToday, loading, busyId, refresh: load, add, setStatus };
}
