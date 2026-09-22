import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS } from '../constants/config';
import { AppUser } from '../types/auth';
import { BarberService } from '../types/service';
import { ShopSettings } from '../types/report';
import { listBarbers } from '../services/authService';
import { subscribeToConnection, isOnline } from '../services/networkService';
import type { ConnectionState } from '../services/networkService';
import { syncEndOfDaySchedule } from '../services/notificationService';
import { getServices } from '../services/serviceService';
import { getSettings, saveSettings } from '../services/settingsService';
import { pendingCount, syncPendingTransactions } from '../services/syncService';
import { useAuth } from '../hooks/useAuth';

interface AppDataContextValue {
  settings: ShopSettings;
  services: BarberService[];
  barbers: AppUser[];
  loading: boolean;
  connection: ConnectionState;
  pending: number;
  refreshServices: () => Promise<void>;
  refreshBarbers: () => Promise<void>;
  updateSettings: (settings: ShopSettings) => Promise<void>;
  syncNow: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [services, setServices] = useState<BarberService[]>([]);
  const [barbers, setBarbers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>('ONLINE');
  const [pending, setPending] = useState(0);

  const refreshServices = useCallback(async () => {
    setServices(await getServices(true));
  }, []);

  const refreshBarbers = useCallback(async () => {
    setBarbers(await listBarbers());
  }, []);

  const syncNow = useCallback(async () => {
    const queued = await pendingCount();
    if (!queued) {
      setPending(0);
      return;
    }
    setConnection('SYNCING');
    const result = await syncPendingTransactions();
    setPending(result.remaining);
    setConnection(result.remaining === 0 && !result.error ? 'SYNCED' : (await isOnline()) ? 'ONLINE' : 'OFFLINE');
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);
    (async () => {
      try {
        const loadedSettings = await getSettings();
        if (!mounted) return;
        setSettings(loadedSettings);
        await syncEndOfDaySchedule(loadedSettings);
        await refreshServices();
        await refreshBarbers();
        setPending(await pendingCount());
        setConnection((await isOnline()) ? 'ONLINE' : 'OFFLINE');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, refreshServices, refreshBarbers]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToConnection(async (online) => {
      setConnection(online ? 'ONLINE' : 'OFFLINE');
      if (online) await syncNow();
    });
    return unsubscribe;
  }, [user, syncNow]);

  const updateSettings = useCallback(async (next: ShopSettings) => {
    const saved = await saveSettings(next);
    setSettings(saved);
    await syncEndOfDaySchedule(saved);
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      settings,
      services,
      barbers,
      loading,
      connection,
      pending,
      refreshServices,
      refreshBarbers,
      updateSettings,
      syncNow,
    }),
    [settings, services, barbers, loading, connection, pending, refreshServices, refreshBarbers, updateSettings, syncNow]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}