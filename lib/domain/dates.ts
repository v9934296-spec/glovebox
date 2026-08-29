/**
 * Pure ISO-date helpers for form UI (unit-testable, no RN imports).
 * Everything stays on the local calendar day so it agrees with `todayIso()`.
 */
import { todayIso } from './due';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = isoToLocalDate(s);
  return localDateToIso(d) === s;
}

/** ISO `YYYY-MM-DD` -> a Date at local midnight (never UTC-shifted). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Date -> ISO `YYYY-MM-DD` using local calendar fields. */
export function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return localDateToIso(d);
}

/** "Aug 12, 2026" — always show the year so a sale report is unambiguous. */
export function formatIsoLong(iso: string): string {
  if (!ISO_DATE_RE.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[(m ?? 1) - 1] ?? '';
  return `${month} ${d ?? 1}, ${y ?? 0}`;
}

/** "Aug 12" — for dense list rows where the year is implied. */
export function formatIsoShort(iso: string): string {
  if (!ISO_DATE_RE.test(iso)) return iso;
  const [, m, d] = iso.split('-').map(Number);
  const month = MONTHS[(m ?? 1) - 1] ?? '';
  return `${month} ${d ?? 1}`;
}

/** "Today" / "Yesterday" / "Aug 12, 2026". */
export function formatIsoRelative(iso: string, today: string = todayIso()): string {
  if (iso === today) return 'Today';
  if (iso === addDaysIso(today, -1)) return 'Yesterday';
  return formatIsoLong(iso);
}
