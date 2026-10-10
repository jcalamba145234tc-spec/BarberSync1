/**
 * Which barbers can take customers today, based on the attendance the admin
 * saved. ABSENT and OFF (leave / day off) barbers are unavailable, so they
 * cannot be picked when the admin logs a service or adds a walk-in to the
 * queue. LATE barbers are still available. A day with no saved attendance
 * counts everyone as available (the default is "Present").
 */
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useCurrentDay } from './useCurrentDay';
import { useDailyAttendance } from './useDailyAttendance';
import { AttendanceStatus } from '../types/attendance';

export type UnavailableStatus = Extract<AttendanceStatus, 'ABSENT' | 'OFF'>;

export function unavailableLabel(status: UnavailableStatus): string {
  return status === 'OFF' ? 'On leave' : 'Absent';
}

export function useBarberAvailability() {
  const { barbers } = useAppData();
  const { attendance, refresh } = useDailyAttendance(useCurrentDay(), barbers);
  const unavailable = useMemo(() => {
    const next: Record<string, UnavailableStatus> = {};
    attendance?.records.forEach((record) => {
      if (record.status === 'ABSENT' || record.status === 'OFF') next[record.barberId] = record.status;
    });
    return next;
  }, [attendance]);
  return { unavailable, refresh };
}
