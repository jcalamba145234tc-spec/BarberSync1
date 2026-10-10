/** Compatibility wrapper for the original barber listener API. */
import { Transaction } from '../types/transaction';
import { subscribeTransactions } from './transactionService';
export interface BarberTransactionRange { barberId: string; from: string; to: string; }
export function subscribeToBarberTransactions(range: BarberTransactionRange,
  next: (rows: Transaction[]) => void, error: (error: unknown) => void = console.warn) {
  return subscribeTransactions({ id: range.barberId, role: 'BARBER' }, range, next, error);
}
