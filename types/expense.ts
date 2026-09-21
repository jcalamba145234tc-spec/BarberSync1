export type ExpenseCategory = 'RENT' | 'UTILITIES' | 'SUPPLIES' | 'MAINTENANCE' | 'OTHER';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO string
  notes: string;
  createdAt: string;
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;
