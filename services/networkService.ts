import NetInfo from '@react-native-community/netinfo';

/**
 * CONNECTIVITY DETECTION
 * ------------------------
 * Thin wrapper around @react-native-community/netinfo. This file answers
 * exactly one question - "is the device online right now?" - and nothing
 * else; it never talks to Firestore. Every read/write service in this app
 * calls isOnline() before deciding whether to hit Firestore directly or
 * fall back to the local AsyncStorage cache / offline queue. The header
 * connection pill (AppDataContext.tsx) subscribes to subscribeToConnection()
 * so the UI updates the moment connectivity changes, without the user
 * needing to manually retry anything.
 */
export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED';

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

export function subscribeToConnection(listener: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    listener(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
}
