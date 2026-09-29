export type UserRole = 'ADMIN' | 'BARBER';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  active: boolean;
  createdAt: string; // ISO string
  specialties?: string[];
  commissionRate?: number; // percentage split (e.g. 0.50 or 50)
  notes?: string;
}

export interface BarberInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  active: boolean;
  specialties?: string[];
  commissionRate?: number;
  notes?: string;
}

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
}

