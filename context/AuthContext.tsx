import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppUser } from '../types/auth';
import { describeAuthError, restoreSession, signIn, signOut } from '../services/authService';

interface AuthContextValue {
  user: AppUser | null;
  initializing: boolean;
  signingIn: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginInProgress = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const restored = await restoreSession();
        if (mounted) setUser(restored);
      } catch (restoreError) {
        console.warn('[BarberSync] Could not restore session.', restoreError);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // State updates are asynchronous, so this also blocks rapid taps before
    // the button has had a chance to re-render as disabled.
    if (loginInProgress.current) return null;

    loginInProgress.current = true;
    setSigningIn(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const profile = await signIn(email, password);
      const remainingDelay = Math.max(0, 2000 - (Date.now() - startedAt));
      if (remainingDelay) {
        await new Promise<void>((resolve) => setTimeout(resolve, remainingDelay));
      }
      setUser(profile);
      return profile;
    } catch (loginError) {
      setError(describeAuthError(loginError));
      return null;
    } finally {
      loginInProgress.current = false;
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signingIn,
      error,
      login,
      logout,
      clearError: () => setError(null),
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, initializing, signingIn, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
