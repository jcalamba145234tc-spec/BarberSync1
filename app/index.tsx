import React from 'react';
import { Redirect } from 'expo-router';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../hooks/useAuth';

/**
 * First-run experience:
 * not logged in -> Login, ADMIN -> admin dashboard, BARBER -> barber dashboard.
 */
export default function Index() {
  const { user, initializing } = useAuth();

  if (initializing) return <LoadingState message="Starting BarberSync…" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.role === 'ADMIN' ? '/(admin)/dashboard' : '/(barber)/dashboard'} />;
}
