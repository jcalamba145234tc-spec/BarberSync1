import { Expense } from '../types/expense';
import { FinancialReport, ReportFilters, ShopSettings } from '../types/report';
import { Transaction } from '../types/transaction';
import { buildFinancialReport } from '../utils/calculations';
import { startOfMonth, endOfMonth, isWithinRange } from '../utils/dateUtils';
import { getExpenses } from './expenseService';
import { applyFilters, getTransactions } from './transactionService';

export interface ReportResult {
  report: FinancialReport;
  transactions: Transaction[];
  expenses: Expense[];
}

/**
 * Builds a report for any date range / payment method / barber combination.
 * Monthly fixed expenses (rent + utilities) are added automatically when the
 * range covers a whole month and no matching expense record exists.
 */
export async function generateReport(
  filters: ReportFilters,
  settings: ShopSettings
): Promise<ReportResult> {
  const transactions = applyFilters(
    await getTransactions({ from: filters.from, to: filters.to }),
    { barberId: filters.barberId, paymentMethod: filters.paymentMethod }
  );
  const expenses = await getExpenses(filters.from, filters.to);

  // A barber-specific or payment-specific report is a slice of revenue, so
  // shop-wide expenses are excluded to avoid a misleading net income.
  const includeExpenses = !filters.barberId && !filters.paymentMethod;
  const report = buildFinancialReport(transactions, includeExpenses ? expenses : [], {
    from: filters.from,
    to: filters.to,
    label: filters.label,
  });

  return { report, transactions, expenses };
}

export function coversFullMonth(from: string, to: string): boolean {
  const start = startOfMonth(new Date(from)).toISOString();
  const end = endOfMonth(new Date(from)).toISOString();
  return from <= start && to >= end;
}

export function expensesInRange(expenses: Expense[], from: string, to: string): Expense[] {
  return expenses.filter((e) => isWithinRange(e.date, from, to));
}
