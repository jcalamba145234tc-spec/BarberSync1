/**
 * Turns a Firestore snapshot into plain rows for the UI. Kept free of any
 * Firebase import (it only needs the snapshot's shape) so the rules can be
 * tested on their own.
 *
 * Returns null for a snapshot answered from the device's own cache. Offline,
 * Firestore replies from an empty in-memory cache; treating that as real data
 * would wipe the rows the screen already has, so callers skip a null result
 * and keep what they are showing.
 */
export interface SnapshotLike<T> {
  metadata: { fromCache: boolean };
  docs: { id: string; data: () => unknown }[];
}

export function rowsFromSnapshot<T extends { id: string }>(snapshot: SnapshotLike<T>): T[] | null {
  if (snapshot.metadata.fromCache) return null;
  return snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
}
