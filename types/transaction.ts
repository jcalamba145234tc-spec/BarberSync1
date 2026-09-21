export type PaymentMethod = 'CASH' | 'GCASH';
export type TransactionStatus = 'COMPLETED' | 'PENDING_GCASH' | 'CANCELLED';

export interface Transaction {
  id: string;
  customerName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  shopShare: number;
  barberShare: number;
  paymentMethod: PaymentMethod;
  gcashReference: string | null;
  gcashScreenshotUrl: string | null;
  /** Local device URI kept while a screenshot has not been uploaded yet. */
  gcashScreenshotLocalUri?: string | null;
  gcashVerified: boolean;
  status: TransactionStatus;
  createdAt: string; // ISO string
  createdBy: string; // user id that recorded the transaction
  synced: boolean;
}

export interface TransactionInput {
  customerName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  gcashReference?: string | null;
  gcashScreenshotLocalUri?: string | null;
  createdBy: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  barberId?: string;
  paymentMethod?: PaymentMethod;
  status?: TransactionStatus;
}
