/**
 * Shapes for the daily attendance feature: one DailyAttendance document per
 * calendar day (id = "YYYY-MM-DD"), holding one BarberAttendanceRecord per
 * staff member for that day. Written/read by services/attendanceService.ts.
 */
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
  /** True while the day has never been saved (only default "Present" placeholders). Never stored. */
  draft?: boolean;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  off: number;
  total: number;
}
