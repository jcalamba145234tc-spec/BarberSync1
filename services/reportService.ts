/**
 * Combines transactions + expenses for a date range into one FinancialReport
 * via utils/calculations.ts. Inherits the 500-record cap from
 * getTransactions() in transactionService.ts - a very high-volume period
 * could theoretically have older records excluded before the date filter is
 * even applied.
 */
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

/** Id prefix of the automatic monthly fixed-expense entries (never stored in Firestore). */
export const AUTO_MONTHLY_EXPENSE_PREFIX = 'auto-monthly-';

/**
 * One automatic "monthly fixed expense" entry for every calendar month the
 * range covers completely (1st through last day). A month that already has a
 * recorded RENT or UTILITIES expense is skipped, so nothing is deducted twice.
 */
export function autoMonthlyExpenses(
  from: string,
  to: string,
  monthlyFixedExpense: number,
  recorded: Expense[]
): Expense[] {
  if (!(monthlyFixedExpense > 0)) return [];
  const start = new Date(from);
  const rangeEnd = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(rangeEnd.getTime())) return [];
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  // The first month only counts when the range starts on its 1st.
  let cursor = new Date(start.getFullYear(), start.getMonth() + (start.getDate() === 1 ? 0 : 1), 1);
  const result: Expense[] = [];

  while (cursor <= end) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    if (end < lastDay) break; // range stops before this month ends

    const alreadyRecorded = recorded.some((expense) => {
      const date = new Date(expense.date);
      return (
        date.getFullYear() === cursor.getFullYear() &&
        date.getMonth() === cursor.getMonth() &&
        (expense.category === 'RENT' || expense.category === 'UTILITIES')
      );
    });

    if (!alreadyRecorded) {
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      result.push({
        id: AUTO_MONTHLY_EXPENSE_PREFIX + cursor.getFullYear() + '-' + month,
        name: 'Monthly fixed expenses',
        amount: monthlyFixedExpense,
        category: 'RENT',
        date: cursor.toISOString(),
        notes: 'Added automatically from Settings (monthly fixed cost).',
        createdAt: cursor.toISOString(),
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return result;
}

/**
 * Builds a report for any date range / payment method / barber combination.
 * Monthly fixed expenses (rent + utilities from Settings) are deducted
 * automatically for every month the range covers completely, unless a RENT or
 * UTILITIES expense is already recorded for that month.
 */
export async function generateReport(
  filters: ReportFilters,
  settings: ShopSettings
): Promise<ReportResult> {
  const transactions = applyFilters(
    await getTransactions({ from: filters.from, to: filters.to }),
    { barberId: filters.barberId, paymentMethod: filters.paymentMethod }
  );
  const recorded = await getExpenses(filters.from, filters.to);

  // A barber-specific or payment-specific report is a slice of revenue, so
  // shop-wide expenses are excluded to avoid a misleading net income.
  const includeExpenses = !filters.barberId && !filters.paymentMethod;
  const expenses = includeExpenses
    ? [
        ...recorded,
        ...autoMonthlyExpenses(filters.from, filters.to, settings.monthlyFixedExpense, recorded),
      ]
    : recorded;

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
