import { useCallback } from 'react';
import { Expense } from '../types/expense';
import { getExpenses } from '../services/expenseService';
import { subscribeExpenses } from '../services/liveData';
import { useAuth } from './useAuth';
import { useRealtimeResource } from './useRealtimeResource';

export function useExpenses(from?: string, to?: string) {
  const { user } = useAuth();
  const id = user?.id;
  const admin = user?.role === 'ADMIN';
  const load = useCallback((cacheOnly: boolean) => admin ? getExpenses(from, to, cacheOnly) : Promise.resolve([]), [from, to, id, admin]);
  const subscribe = useCallback((next: (rows: Expense[]) => void, error: (error: unknown) => void) =>
    id && admin ? subscribeExpenses(id, from, to, next, error) : () => {}, [id, admin, from, to]);
  const result = useRealtimeResource<Expense[]>([], load, subscribe);
  return { expenses: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}
