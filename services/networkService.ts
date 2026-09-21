import NetInfo from '@react-native-community/netinfo';

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
