import { useCallback, useEffect, useState } from 'react';
import { Transaction, TransactionFilters } from '../types/transaction';
import { getTransactions } from '../services/transactionService';

/** Loads transactions with the given filters and exposes a manual refresh. */
export function useTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTransactions(await getTransactions(JSON.parse(key) as TransactionFilters));
    } catch (loadError) {
      console.warn('[BarberSync] Could not load transactions.', loadError);
      setError('Could not load transactions. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { transactions, loading, error, refresh: load, setTransactions };
}
