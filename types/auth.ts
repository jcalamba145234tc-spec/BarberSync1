export type UserRole = 'ADMIN' | 'BARBER';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  active: boolean;
  createdAt: string; // ISO string
}

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
}
