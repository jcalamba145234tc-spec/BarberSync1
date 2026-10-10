import { useCallback } from 'react';
import { Transaction, TransactionFilters } from '../types/transaction';
import { getTransactions, subscribeTransactions } from '../services/transactionService';
import { useAuth } from './useAuth';
import { useRealtimeResource } from './useRealtimeResource';

/** Live selected-range transactions; identical queries share one listener. */
export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const id = user?.id;
  const role = user?.role;
  const load = useCallback((cacheOnly: boolean) =>
    getTransactions(JSON.parse(key), cacheOnly), [key, id, role]);
  const subscribe = useCallback((next: (rows: Transaction[]) => void, error: (error: unknown) => void) => {
    if (!id || !role) return () => {};
    return subscribeTransactions({ id, role }, JSON.parse(key), next, error);
  }, [key, id, role]);
  const result = useRealtimeResource<Transaction[]>([], load, subscribe);
  return { transactions: result.data, setTransactions: result.setData,
    loading: result.loading, error: result.error, refresh: result.refresh };
}
