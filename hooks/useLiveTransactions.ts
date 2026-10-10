/**
 * Same result shape as useTransactions, but for a barber's own rows it also
 * listens to Firestore live (see services/liveTransactions.ts): a service the
 * owner records shows up here immediately, with no refresh.
 *
 * One-time fetch + live listener, the same pairing the queue uses:
 *  - the fetch covers offline mode and local/demo mode (a listener needs a real
 *    Firestore connection) and gives the screen something to show before the
 *    first live snapshot arrives;
 *  - once a live snapshot has arrived it wins, so a slow fetch that finishes
 *    afterwards can never overwrite newer live data with older rows.
 *
 * The listener stays on while the barber is in the app (instead of
 * re-subscribing on every tab focus), so after the first read it only receives
 * the changes.
 */
import { useCallback, useEffect, useState } from 'react';
import { Transaction, TransactionFilters } from '../types/transaction';
import { subscribeToBarberTransactions } from '../services/liveTransactions';
import { getTransactions } from '../services/transactionService';

export function useLiveTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filters);

  /** Manual refresh (pull-to-refresh): one-time read. Live updates continue after it. */
  const refresh = useCallback(async () => {
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
    let mounted = true;
    let gotLive = false;
    const current = JSON.parse(key) as TransactionFilters;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const rows = await getTransactions(current);
        if (mounted && !gotLive) setTransactions(rows);
      } catch (loadError) {
        console.warn('[BarberSync] Could not load transactions.', loadError);
        if (mounted && !gotLive) setError('Could not load transactions. Pull down to try again.');
      } finally {
        if (mounted && !gotLive) setLoading(false);
      }
    })();

    const unsubscribe =
      current.barberId && current.from && current.to
        ? subscribeToBarberTransactions(
            { barberId: current.barberId, from: current.from, to: current.to },
            (rows) => {
              if (!mounted) return;
              gotLive = true;
              setTransactions(rows);
              setLoading(false);
              setError(null);
            }
          )
        : () => {};

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [key]);

  return { transactions, loading, error, refresh, setTransactions };
}
