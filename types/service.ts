export interface BarberService {
  id: string;
  name: string;
  price: number;
  /** Average duration in minutes, used to estimate queue waiting time. */
  durationMinutes: number;
  active: boolean;
  createdAt: string;
}

export type ServiceInput = Omit<BarberService, 'id' | 'createdAt'>;
