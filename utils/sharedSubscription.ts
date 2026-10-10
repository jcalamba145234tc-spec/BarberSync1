/** Fan out one backend listener per auth/query key; release it after the last consumer. */
export function createSubscriptionPool<T>() {
  type Consumer = { next: (value: T) => void; error?: (error: unknown) => void };
  const entries = new Map<string, {
    consumers: Set<Consumer>; stop: () => void; value?: T; hasValue: boolean;
  }>();
  return (key: string, start: (next: (value: T) => void, error: (error: unknown) => void) => () => void,
    next: (value: T) => void, error?: (error: unknown) => void): (() => void) => {
    const consumer = { next, error };
    let entry = entries.get(key);
    if (!entry) {
      entry = { consumers: new Set([consumer]), stop: () => {}, hasValue: false };
      entries.set(key, entry);
      const current = entry;
      current.stop = start((value) => {
        current.value = value;
        current.hasValue = true;
        current.consumers.forEach((c) => c.next(value));
      }, (failure) => current.consumers.forEach((c) => c.error?.(failure)));
    } else {
      entry.consumers.add(consumer);
      if (entry.hasValue) next(entry.value as T);
    }
    return () => {
      entry!.consumers.delete(consumer);
      if (!entry!.consumers.size) {
        entry!.stop();
        entries.delete(key);
      }
    };
  };
}
