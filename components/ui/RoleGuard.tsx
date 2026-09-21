import React from 'react';
import { Redirect } from 'expo-router';
import { UserRole } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from './LoadingState';

/**
 * Route protection. Unauthenticated users go back to Login and a barber can
 * never open an admin route, even by typing the URL.
 * (Firestore rules enforce the same thing on the server side.)
 */
export function RoleGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, initializing } = useAuth();

  if (initializing) return <LoadingState message="Checking your account…" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== role) {
    return <Redirect href={user.role === 'ADMIN' ? '/(admin)/dashboard' : '/(barber)/dashboard'} />;
  }
  return <>{children}</>;
}
