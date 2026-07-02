import type { Reminder } from './types';

export type DueState = 'overdue' | 'due_soon' | 'upcoming' | 'no_due';

export const DUE_SOON_DAYS = 14;
export const DUE_SOON_MILES = 500;

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Today as YYYY-MM-DD in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Due state from optional date and mileage targets. The more urgent of the two wins,
 * so "oil change: 5,000 mi or 6 months" flags as soon as either is close.
 */
export function dueState(args: {
  dueDate: string | null;
  dueMileage: number | null;
  currentMileage: number;
  today?: string;
}): DueState {
  const today = args.today ?? todayIso();
  const states: DueState[] = [];

  if (args.dueDate) {
    const days = daysBetween(today, args.dueDate);
    if (days < 0) states.push('overdue');
    else if (days <= DUE_SOON_DAYS) states.push('due_soon');
    else states.push('upcoming');
  }
  if (args.dueMileage != null) {
    const milesLeft = args.dueMileage - args.currentMileage;
    if (milesLeft < 0) states.push('overdue');
    else if (milesLeft <= DUE_SOON_MILES) states.push('due_soon');
    else states.push('upcoming');
  }

  if (states.length === 0) return 'no_due';
  if (states.includes('overdue')) return 'overdue';
  if (states.includes('due_soon')) return 'due_soon';
  return 'upcoming';
}

export function reminderDueState(reminder: Reminder, currentMileage: number, today?: string): DueState {
  if (reminder.status === 'completed') return 'no_due';
  return dueState({
    dueDate: reminder.dueDate,
    dueMileage: reminder.dueMileage,
    currentMileage,
    today,
  });
}

/** Human summary like "in 12 days", "800 mi left", "overdue by 3 days". */
export function dueSummary(args: {
  dueDate: string | null;
  dueMileage: number | null;
  currentMileage: number;
  today?: string;
}): string {
  const today = args.today ?? todayIso();
  const parts: string[] = [];
  if (args.dueDate) {
    const days = daysBetween(today, args.dueDate);
    if (days < 0) parts.push(`overdue by ${Math.abs(days)}d`);
    else if (days === 0) parts.push('due today');
    else parts.push(`in ${days}d`);
  }
  if (args.dueMileage != null) {
    const miles = args.dueMileage - args.currentMileage;
    if (miles < 0) parts.push(`${Math.abs(miles).toLocaleString()} mi over`);
    else parts.push(`${miles.toLocaleString()} mi left`);
  }
  return parts.join(' · ') || 'no due set';
}

/** Add months to an ISO date, clamping to end of month (Jan 31 + 1mo = Feb 28). */
export function addMonthsIso(dateIso: string, months: number): string {
  const [yRaw, mRaw, dRaw] = dateIso.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Next occurrence for a recurring reminder after completion.
 * Returns null when the reminder does not recur.
 */
export function nextOccurrence(
  reminder: Reminder,
  completion: { date: string; mileage: number },
): { dueDate: string | null; dueMileage: number | null } | null {
  if (reminder.recurrenceType === 'none') return null;
  const wantsDate = reminder.recurrenceType === 'date' || reminder.recurrenceType === 'both';
  const wantsMiles = reminder.recurrenceType === 'mileage' || reminder.recurrenceType === 'both';

  const dueDate =
    wantsDate && reminder.recurrenceIntervalMonths
      ? addMonthsIso(completion.date, reminder.recurrenceIntervalMonths)
      : null;
  const dueMileage =
    wantsMiles && reminder.recurrenceIntervalMiles
      ? completion.mileage + reminder.recurrenceIntervalMiles
      : null;

  if (dueDate === null && dueMileage === null) return null;
  return { dueDate, dueMileage };
}
