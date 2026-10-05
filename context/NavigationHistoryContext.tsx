/**
 * Tracks the previously visited screen so HeaderBackButton has something
 * reliable to go back to, since Expo Router's tab navigation doesn't always
 * keep a full back-stack the way a plain stack navigator would.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSegments } from 'expo-router';

interface NavigationHistoryValue {
  previousPath: string | null;
}

const NavigationHistoryContext = createContext<NavigationHistoryValue>({ previousPath: null });

/**
 * Keeps the screen visited immediately before the current one. Tabs do not
 * always retain stack history, so headers use this as a reliable back target.
 */
export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  // Keep route groups (such as `(admin)`) because both roles have a
  // `dashboard` route and the back target must preserve the active role.
  const segments = useSegments();
  const pathname = `/${segments.join('/')}`;
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory((current) => (current[current.length - 1] === pathname ? current : [...current, pathname].slice(-20)));
  }, [pathname]);

  const value = useMemo<NavigationHistoryValue>(
    () => ({ previousPath: history.length > 1 ? history[history.length - 2] : null }),
    [history]
  );

  return <NavigationHistoryContext.Provider value={value}>{children}</NavigationHistoryContext.Provider>;
}

export function useNavigationHistory() {
  return useContext(NavigationHistoryContext);
}
