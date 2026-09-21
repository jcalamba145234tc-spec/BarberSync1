import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
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
    setSigningIn(true);
    setError(null);
    try {
      const profile = await signIn(email, password);
      setUser(profile);
      return profile;
    } catch (loginError) {
      setError(describeAuthError(loginError));
      return null;
    } finally {
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
