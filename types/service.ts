/**
 * Shape of one entry in the shop's service/price menu, managed by admins in
 * services/serviceService.ts and read by every screen that logs a sale.
 */
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
