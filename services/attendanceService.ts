import { doc, getDoc, setDoc } from 'firebase/firestore';
import { COLLECTIONS, STORAGE_KEYS } from '../constants/config';
import { AppUser } from '../types/auth';
import {
  AttendanceSummary,
  BarberAttendanceRecord,
  DailyAttendance,
} from '../types/attendance';
import { firestore } from './firebase';
import { readJson, writeJson } from './localStore';
import { isOnline } from './networkService';

/**
 * ATTENDANCE: READ / WRITE PATTERN
 * ----------------------------------
 * One Firestore document per calendar day, read with getDoc() and written
 * with setDoc(..., { merge: true }) - a one-time read/write, not a live
 * listener, so the admin needs to reopen or refresh the screen to see
 * changes made from another device. Reads fall back to the local
 * AsyncStorage cache (see readAttendanceMap/writeAttendanceMap below) when
 * offline or when Firestore rejects the read, e.g. firestore.rules not yet
 * covering the attendance/ collection.
 */

async function readAttendanceMap(): Promise<Record<string, DailyAttendance>> {
  return readJson<Record<string, DailyAttendance>>(STORAGE_KEYS.cachedAttendance, {});
}

async function writeAttendanceMap(map: Record<string, DailyAttendance>): Promise<void> {
  await writeJson(STORAGE_KEYS.cachedAttendance, map);
}

/**
 * Loads attendance for a given date (YYYY-MM-DD). If no record exists yet,
 * it initializes a draft with all active barbers marked as PRESENT.
 */
export async function getDailyAttendance(
  dateStr: string,
  barbers: AppUser[]
): Promise<DailyAttendance> {
  const activeBarbers = barbers.filter((b) => b.active !== false);
  let attendance: DailyAttendance | null = null;

  if (firestore && (await isOnline())) {
    try {
      const snap = await getDoc(doc(firestore, COLLECTIONS.attendance, dateStr));
      if (snap.exists()) {
        attendance = snap.data() as DailyAttendance;
      }
    } catch (error) {
      console.warn('[BarberSync] Falling back to cached attendance.', error);
    }
  }

  if (!attendance) {
    const map = await readAttendanceMap();
    if (map[dateStr]) {
      attendance = map[dateStr];
    }
  }

  if (attendance) {
    // Reconcile: ensure any active barbers added after saving are included
    const existingIds = new Set(attendance.records.map((r) => r.barberId));
    const missingRecords: BarberAttendanceRecord[] = activeBarbers
      .filter((b) => !existingIds.has(b.id))
      .map((b) => ({
        barberId: b.id,
        barberName: b.name,
        status: 'PRESENT',
      }));

    if (missingRecords.length > 0) {
      attendance = {
        ...attendance,
        records: [...attendance.records, ...missingRecords],
      };
    }
    return attendance;
  }

  // Create default attendance for today / the requested date
  const defaultRecords: BarberAttendanceRecord[] = activeBarbers.map((b) => ({
    barberId: b.id,
    barberName: b.name,
    status: 'PRESENT',
  }));

  const initial: DailyAttendance = {
    id: dateStr,
    date: dateStr,
    records: defaultRecords,
    updatedAt: new Date().toISOString(),
    // Placeholder only: nothing is cached or stored until the admin saves, so
    // browsing past dates never creates fake "Present" records.
    draft: true,
  };

  return initial;
}

/**
 * Saves attendance to local cache and Firestore.
 */
export async function saveDailyAttendance(attendance: DailyAttendance): Promise<void> {
  const { draft: _draft, ...rest } = attendance;
  const updated: DailyAttendance = {
    ...rest,
    updatedAt: new Date().toISOString(),
  };

  const map = await readAttendanceMap();
  map[updated.id] = updated;
  await writeAttendanceMap(map);

  if (firestore && (await isOnline())) {
    try {
      await setDoc(doc(firestore, COLLECTIONS.attendance, updated.id), updated, { merge: true });
    } catch (error) {
      console.warn('[BarberSync] Could not save attendance remotely.', error);
    }
  }
}

/**
 * Calculates present, absent, late, off, and total counts.
 */
export function calculateAttendanceSummary(records: BarberAttendanceRecord[]): AttendanceSummary {
  let present = 0;
  let absent = 0;
  let late = 0;
  let off = 0;

  records.forEach((r) => {
    switch (r.status) {
      case 'PRESENT':
        present += 1;
        break;
      case 'ABSENT':
        absent += 1;
        break;
      case 'LATE':
        late += 1;
        break;
      case 'OFF':
        off += 1;
        break;
    }
  });

  return {
    present,
    absent,
    late,
    off,
    total: records.length,
  };
}
