import { PaymentMethod } from './transaction';

export interface ReportRange {
  from: string; // ISO
  to: string; // ISO
  label: string;
}

export interface BarberPerformance {
  barberId: string;
  barberName: string;
  serviceCount: number;
  revenue: number;
  earnings: number;
}

export interface FinancialReport {
  range: ReportRange;
  grossRevenue: number;
  shopShare: number;
  barberShare: number;
  cashRevenue: number;
  gcashRevenue: number;
  transactionCount: number;
  expenses: number;
  netIncome: number;
  barbers: BarberPerformance[];
}

export interface ReportFilters {
  from: string;
  to: string;
  label: string;
  paymentMethod?: PaymentMethod;
  barberId?: string;
}

export interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopContact: string;
  shopPercentage: number; // 0.5
  barberPercentage: number; // 0.5
  minimumServicePrice: number;
  monthlyFixedExpense: number;
  notificationsEnabled: boolean;
  endOfDaySummaryEnabled: boolean;
}
