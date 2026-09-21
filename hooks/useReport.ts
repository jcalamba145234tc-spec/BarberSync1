import { useCallback, useEffect, useState } from 'react';
import { FinancialReport, ReportFilters, ShopSettings } from '../types/report';
import { Transaction } from '../types/transaction';
import { Expense } from '../types/expense';
import { generateReport } from '../services/reportService';

export function useReport(filters: ReportFilters, settings: ShopSettings) {
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReport(JSON.parse(key) as ReportFilters, settings);
      setReport(result.report);
      setTransactions(result.transactions);
      setExpenses(result.expenses);
    } catch (reportError) {
      console.warn('[BarberSync] Could not build report.', reportError);
      setError('Could not build the report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [key, settings]);

  useEffect(() => {
    load();
  }, [load]);

  return { report, transactions, expenses, loading, error, refresh: load };
}
