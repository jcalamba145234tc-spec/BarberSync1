import { useCallback, useEffect, useState } from 'react';
import { QueueEntry, QueueInput, QueueStatus } from '../types/queue';
import { BarberService } from '../types/service';
import { addToQueue, getQueue, updateQueueStatus } from '../services/queueService';

export function useQueue(services: BarberService[]) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getQueue(services));
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    load();
  }, [load]);

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

  return { queue, loading, busyId, refresh: load, add, setStatus };
}
