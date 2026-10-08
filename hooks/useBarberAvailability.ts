/**
 * Which barbers can take customers today, based on the attendance the admin
 * saved. ABSENT and OFF (leave / day off) barbers are unavailable, so they
 * cannot be picked when the admin logs a service or adds a walk-in to the
 * queue. LATE barbers are still available. A day with no saved attendance
 * counts everyone as available (the default is "Present").
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppData } from '../context/AppDataContext';
import { getDailyAttendance } from '../services/attendanceService';
import { AttendanceStatus } from '../types/attendance';

/** Local-date key (YYYY-MM-DD), same format the Attendance screen saves under. */
function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type UnavailableStatus = Extract<AttendanceStatus, 'ABSENT' | 'OFF'>;

export function unavailableLabel(status: UnavailableStatus): string {
  return status === 'OFF' ? 'On leave' : 'Absent';
}

export function useBarberAvailability() {
  const { barbers } = useAppData();
  const [unavailable, setUnavailable] = useState<Record<string, UnavailableStatus>>({});

  const refresh = useCallback(async () => {
    try {
      const attendance = await getDailyAttendance(todayKey(), barbers);
      const next: Record<string, UnavailableStatus> = {};
      attendance.records.forEach((record) => {
        if (record.status === 'ABSENT' || record.status === 'OFF') next[record.barberId] = record.status;
      });
      setUnavailable(next);
    } catch (error) {
      console.warn('[BarberSync] Could not load barber availability.', error);
    }
  }, [barbers]);

  // Re-check every time the screen is shown, so attendance changes apply right away.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { unavailable, refresh };
}
