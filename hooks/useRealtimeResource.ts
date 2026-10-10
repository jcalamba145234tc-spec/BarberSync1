import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Cache-first on focus, then live. Slow reads cannot overwrite a newer snapshot/range. */
export function useRealtimeResource<T>(
  initial: T,
  load: (cacheOnly: boolean) => Promise<T>,
  subscribe: (next: (value: T) => void, error: (error: unknown) => void) => () => void,
) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const epoch = useRef(0);
  const revision = useRef(0);
  const request = useRef(0);
  const focused = useRef(false);

  const read = useCallback(async (cacheOnly: boolean) => {
    const generation = epoch.current;
    const version = revision.current;
    const ticket = ++request.current;
    setLoading(true);
    try {
      const value = await load(cacheOnly);
      if (focused.current && generation === epoch.current && version === revision.current && ticket === request.current) {
        setData(value);
      }
    } catch (failure) {
      if (focused.current && generation === epoch.current && version === revision.current && ticket === request.current) {
        console.warn('[BarberSync] Data read failed.', failure);
        setError('Could not load data. Pull down to retry.');
      }
    } finally {
      if (focused.current && generation === epoch.current && ticket === request.current) setLoading(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    const generation = ++epoch.current;
    setError(null);
    void read(true);
    const stop = subscribe((value) => {
      if (!focused.current || generation !== epoch.current) return;
      revision.current++;
      setData(value);
      setLoading(false);
      setError(null);
    }, (failure) => {
      if (!focused.current || generation !== epoch.current) return;
      console.warn('[BarberSync] Live listener failed.', failure);
      setError('Live updates unavailable. Pull down to retry; displayed data may be stale.');
      setLoading(false);
    });
    return () => { focused.current = false; epoch.current++; stop(); };
  }, [read, subscribe, retry]));

  const refresh = useCallback(async () => {
    if (error) setRetry((value) => value + 1);
    await read(false);
  }, [read, error]);
  return { data, setData, loading, error, refresh };
}
