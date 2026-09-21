export type QueueStatus = 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';

export interface QueueEntry {
  id: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  status: QueueStatus;
  arrivalTime: string;
  estimatedWaitTime: number; // minutes
  startedAt: string | null;
  completedAt: string | null;
}

export interface QueueInput {
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  durationMinutes: number;
}
