/**
 * Loads and manages the walk-in queue for a screen - optionally scoped to one
 * barber's own entries. Wraps services/queueService.ts and exposes simple
 * loading/busy state for the UI.
 *
 * Unlike the rest of the app, this subscribes to a LIVE Firestore listener
 * while the screen is focused, so a walk-in added from a different device
 * appears here without needing a manual refresh. It falls back to a one-time
 * fetch for offline / local-demo-mode, since a live listener needs a real
 * Firestore connection to fire at all.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { QueueEntry, QueueInput, QueueStatus } from '../types/queue';
import { BarberService } from '../types/service';
import { addToQueue, getQueue, isActive, subscribeToQueue, updateQueueStatus } from '../services/queueService';

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
      setLoading(true);

      // Always do one immediate fetch - this is what covers offline mode and
      // local/demo mode (no real Firestore project configured), and also
      // gives the screen something to show before the first live snapshot
      // arrives.
      (async () => {
        try {
          const entries = await getQueue(services);
          if (mounted) setQueue(filterForBarber(entries));
        } finally {
          if (mounted) setLoading(false);
        }
      })();

      // Live updates while this screen is focused - a no-op if Firestore
      // isn't configured, in which case the one-time fetch above is all
      // this screen gets, same as every other screen in the app.
      const unsubscribe = subscribeToQueue(
        services,
        (entries) => {
          if (!mounted) return;
          setQueue(filterForBarber(entries));
          setLoading(false);
        },
        (error) => {
          // Listener failed (e.g. permission error, connection dropped) -
          // the screen keeps showing whatever it last had rather than
          // clearing to empty.
          console.warn('[BarberSync] Queue live updates unavailable, staying on last known data.', error);
        }
      );

      return () => {
        mounted = false;
        unsubscribe();
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
