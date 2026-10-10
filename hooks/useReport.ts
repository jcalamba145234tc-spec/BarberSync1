import { useCallback, useMemo } from 'react';
import { ReportFilters, ShopSettings } from '../types/report';
import { buildReportResult } from '../services/reportService';
import { useTransactions } from './useTransactions';
import { useExpenses } from './useExpenses';

/** Recalculate when either source or shop settings changes, without extra reads. */
export function useReport(filters: ReportFilters, settings: ShopSettings) {
  const tx = useTransactions({ from: filters.from, to: filters.to,
    barberId: filters.barberId, paymentMethod: filters.paymentMethod });
  const ex = useExpenses(filters.from, filters.to);
  const key = JSON.stringify(filters);
  const result = useMemo(() => buildReportResult(JSON.parse(key), settings, tx.transactions, ex.expenses),
    [key, settings, tx.transactions, ex.expenses]);
  const refresh = useCallback(async () => { await Promise.all([tx.refresh(), ex.refresh()]); }, [tx.refresh, ex.refresh]);
  return { ...result, loading: tx.loading || ex.loading, error: tx.error || ex.error, refresh };
}
