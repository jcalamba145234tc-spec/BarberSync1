export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'OFF';

export interface BarberAttendanceRecord {
  barberId: string;
  barberName: string;
  status: AttendanceStatus;
  checkInTime?: string;
  notes?: string;
}

export interface DailyAttendance {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  records: BarberAttendanceRecord[];
  updatedAt: string;
  savedBy?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  off: number;
  total: number;
}
