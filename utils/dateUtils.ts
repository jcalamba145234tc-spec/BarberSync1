import { ReportRange } from '../types/report';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** September 19, 2026 */
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 1:35 PM */
export function formatTime(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** September 19, 2026 · 1:35 PM */
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // Sunday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(date: Date = new Date()): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function endOfMonth(date: Date = new Date()): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  const d1 = toDate(a);
  const d2 = toDate(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(value: string | Date): boolean {
  return isSameDay(value, new Date());
}

export function isWithinRange(value: string | Date, from: string | Date, to: string | Date): boolean {
  const time = toDate(value).getTime();
  return time >= toDate(from).getTime() && time <= toDate(to).getTime();
}

export type RangePreset = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH';

export function buildRange(preset: RangePreset, reference: Date = new Date()): ReportRange {
  switch (preset) {
    case 'YESTERDAY': {
      const y = new Date(reference);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString(), label: 'Yesterday' };
    }
    case 'WEEK':
      return {
        from: startOfWeek(reference).toISOString(),
        to: endOfDay(reference).toISOString(),
        label: 'This Week',
      };
    case 'MONTH':
      return {
        from: startOfMonth(reference).toISOString(),
        to: endOfMonth(reference).toISOString(),
        label: 'This Month',
      };
    case 'TODAY':
    default:
      return {
        from: startOfDay(reference).toISOString(),
        to: endOfDay(reference).toISOString(),
        label: 'Today',
      };
  }
}

export function customRange(from: Date, to: Date): ReportRange {
  return {
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
    label: `${formatDate(from)} – ${formatDate(to)}`,
  };
}

/** Accepts YYYY-MM-DD and returns a Date, or null when invalid. */
export function parseInputDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fileTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
