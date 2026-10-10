import { useCallback } from 'react';
import { AppUser } from '../types/auth';
import { DailyAttendance } from '../types/attendance';
import { getDailyAttendance } from '../services/attendanceService';
import { subscribeAttendance } from '../services/liveData';
import { useAuth } from './useAuth';
import { useRealtimeResource } from './useRealtimeResource';

export function useDailyAttendance(date: string, barbers: AppUser[]) {
  const { user } = useAuth();
  const id = user?.id;
  const load = useCallback((cacheOnly: boolean) => getDailyAttendance(date, barbers, cacheOnly), [date, barbers, id]);
  const subscribe = useCallback((next: (day: DailyAttendance | null) => void, error: (error: unknown) => void) =>
    id ? subscribeAttendance(id, date, barbers, next, error) : () => {}, [id, date, barbers]);
  const result = useRealtimeResource<DailyAttendance | null>(null, load, subscribe);
  return { attendance: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}
