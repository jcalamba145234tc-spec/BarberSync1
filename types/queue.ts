/**
 * Walk-in queue entry shape, shared by both the admin and barber Queue
 * screens (components/queue/QueueBoard.tsx) via services/queueService.ts.
 */
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
  /** Optional customer tip (PHP), recorded by the owner when completing. Belongs to the barber. */
  tip?: number | null;
}

export interface QueueInput {
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  durationMinutes: number;
}
