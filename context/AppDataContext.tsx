/**
 * App-wide data shared across every screen after login: shop settings,
 * service menu, barber list (admin-only, see refreshBarbers below), live
 * connection state, and pending-sync count. Centralizing this here means a
 * screen doesn't each need to independently fetch the same shared data.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { subscribeSharedData } from '../services/liveData';
import { useAuth } from '../hooks/useAuth';

interface AppDataContextValue {
  settings: ShopSettings;
  services: BarberService[];
  barbers: AppUser[];
  loading: boolean;
  connection: ConnectionState;
  pending: number;
  liveError: string | null;
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
  const [liveError, setLiveError] = useState<string | null>(null);
  const revisions = useRef({ services: 0, barbers: 0 });

  const refreshServices = useCallback(async () => {
    const version = revisions.current.services;
    const rows = await getServices(true);
    if (version === revisions.current.services) setServices(rows);
  }, []);

  const refreshBarbers = useCallback(async () => {
    // Only admins are allowed to read the full staff list (see firestore.rules:
    // users/{userId} only grants read to isSelf(userId) || isAdmin()). A barber
    // never needs this list — the transaction form locks them to their own
    // profile — so skipping the call for barbers avoids a guaranteed
    // permission-denied warning on every login.
    if (user?.role !== 'ADMIN') {
      setBarbers([]);
      return;
    }
    const version = revisions.current.barbers;
    const rows = await listBarbers();
    if (version === revisions.current.barbers) setBarbers(rows);
  }, [user?.role]);

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
      setSettings(DEFAULT_SETTINGS);
      setServices([]);
      setBarbers([]);
      setLiveError(null);
      setLoading(false);
      return;
    }
    const received = { settings: false, services: false, barbers: false };
    setLoading(true);
    setLiveError(null);
    const stop = subscribeSharedData(user, {
      settings: (next) => {
        if (!mounted) return;
        received.settings = true;
        setSettings(next);
      },
      services: (rows) => {
        if (!mounted) return;
        received.services = true;
        revisions.current.services++;
        setServices(rows);
      },
      barbers: (rows) => {
        if (!mounted) return;
        received.barbers = true;
        revisions.current.barbers++;
        setBarbers(rows);
      },
      error: (error) => {
        if (!mounted) return;
        console.warn('[BarberSync] Shared live data failed.', error);
        setLiveError('Some live updates are unavailable. Check your connection and Firebase permissions.');
      },
    });
    (async () => {
      try {
        const [loadedSettings, menu, staff] = await Promise.all([
          getSettings(true), getServices(true, true),
          user.role === 'ADMIN' ? listBarbers(true, true) : Promise.resolve([]),
        ]);
        if (!mounted) return;
        if (!received.settings) setSettings(loadedSettings);
        if (!received.services) setServices(menu);
        if (!received.barbers) setBarbers(staff);
        setPending(await pendingCount());
        if (mounted) setConnection((await isOnline()) ? 'ONLINE' : 'OFFLINE');
      } catch (error) {
        console.warn('[BarberSync] Initial cached data failed.', error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; stop(); };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user) void syncEndOfDaySchedule(settings).catch((error) =>
      console.warn('[BarberSync] Could not update notification schedule.', error));
  }, [settings, user?.id]);

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
      liveError,
      refreshServices,
      refreshBarbers,
      updateSettings,
      syncNow,
    }),
    [settings, services, barbers, loading, connection, pending, liveError, refreshServices, refreshBarbers, updateSettings, syncNow]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}