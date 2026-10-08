/**
 * Pure money-math functions: the shop/barber revenue split, rounding to 2
 * decimals so totals never drift from floating-point error, and building the
 * financial report totals. No Firebase or React here on purpose, so this
 * logic is easy to unit test in isolation.
 */
import { DEFAULT_SETTINGS } from '../constants/config';
import { Expense } from '../types/expense';
import { BarberPerformance, FinancialReport, ReportRange, ShopSettings } from '../types/report';
import { Transaction } from '../types/transaction';

export interface RevenueSplit {
  shopShare: number;
  barberShare: number;
}

/** Minimal shape of a staff member needed to build the performance table. */
export interface BarberRef {
  id: string;
  name: string;
}

/** Rounds to 2 decimals so money never drifts because of float math. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Core business rule of BarberSync.
 * Splits a transaction amount between the shop and the barber.
 * Percentages come from shop settings (defaults to 50/50).
 */
export function calculateRevenueSplit(
  amount: number,
  shopPercentage: number = DEFAULT_SETTINGS.shopPercentage
): RevenueSplit {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const safePercentage = shopPercentage >= 0 && shopPercentage <= 1 ? shopPercentage : 0.5;
  const shopShare = round2(safeAmount * safePercentage);
  const barberShare = round2(safeAmount - shopShare);
  return { shopShare, barberShare };
}

/** Philippine peso formatting, e.g. ₱1,250 or ₱1,250.50 */
export function formatCurrency(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  const hasCents = Math.abs(amount % 1) > 0.001;
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + (value || 0), 0));
}

/** Only COMPLETED transactions count toward money totals. */
export function countableTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.status === 'COMPLETED');
}

function normalizeName(name: string | undefined | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Builds one performance row per barber.
 *
 * - Without `barbers`: groups by the barberId saved on each transaction
 *   (used by the financial report).
 * - With `barbers` (the real staff list): every transaction is matched to a
 *   current staff member, first by ID, then by name. This guarantees one row
 *   per barber, so a transaction saved with a stray/old barberId can never
 *   create a duplicate row (e.g. "Juan Dela Cruz" twice). Transactions that
 *   match nobody are left out of the staff table.
 */
export function buildBarberPerformance(
  transactions: Transaction[],
  barbers?: BarberRef[]
): BarberPerformance[] {
  const byId = new Map<string, BarberRef>();
  const byName = new Map<string, BarberRef>();
  (barbers ?? []).forEach((b) => {
    byId.set(b.id, b);
    const key = normalizeName(b.name);
    if (key && !byName.has(key)) byName.set(key, b);
  });

  const map = new Map<string, BarberPerformance>();

  countableTransactions(transactions).forEach((t) => {
    let barberId = t.barberId;
    let barberName = t.barberName;

    if (barbers) {
      const match = byId.get(t.barberId) ?? byName.get(normalizeName(t.barberName));
      if (!match) return; // not a current staff member
      barberId = match.id;
      barberName = match.name;
    }

    const existing = map.get(barberId) ?? {
      barberId,
      barberName,
      serviceCount: 0,
      revenue: 0,
      earnings: 0,
    };
    existing.serviceCount += 1;
    existing.revenue = round2(existing.revenue + t.amount);
    existing.earnings = round2(existing.earnings + t.barberShare);
    map.set(barberId, existing);
  });

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Builds a full financial report.
 * netIncome = grossRevenue - expenses. The barber payout is a revenue split,
 * so it is reported separately and never subtracted twice.
 */
export function buildFinancialReport(
  transactions: Transaction[],
  expenses: Expense[],
  range: ReportRange
): FinancialReport {
  const completed = countableTransactions(transactions);
  const grossRevenue = sum(completed.map((t) => t.amount));
  const shopShare = sum(completed.map((t) => t.shopShare));
  const barberShare = sum(completed.map((t) => t.barberShare));
  const tips = sum(completed.map((t) => t.tip ?? 0));
  const cashRevenue = sum(completed.filter((t) => t.paymentMethod === 'CASH').map((t) => t.amount));
  const gcashRevenue = sum(completed.filter((t) => t.paymentMethod === 'GCASH').map((t) => t.amount));
  const expenseTotal = sum(expenses.map((e) => e.amount));

  return {
    range,
    grossRevenue,
    shopShare,
    barberShare,
    tips,
    cashRevenue,
    gcashRevenue,
    transactionCount: completed.length,
    expenses: expenseTotal,
    netIncome: round2(grossRevenue - expenseTotal),
    barbers: buildBarberPerformance(completed),
  };
}

/** Estimated wait = sum of durations of everyone ahead in the queue. */
export function calculateEstimatedWait(minutesAhead: number[]): number {
  return minutesAhead.reduce((total, minutes) => total + (minutes || 0), 0);
}

export function resolveSplitPercentage(settings: ShopSettings | null): number {
  return settings?.shopPercentage ?? DEFAULT_SETTINGS.shopPercentage;
}
