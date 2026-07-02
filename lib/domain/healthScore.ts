import { reminderDueState } from './due';
import { serviceTypeDef } from './serviceTypes';
import type { Reminder, ServiceRecord, Vehicle } from './types';

export type HealthResult = {
  score: number;
  label: 'Great' | 'Good' | 'Fair' | 'Needs attention';
  reasons: string[];
};

const EXPENSIVE_REPAIR_THRESHOLD = 1000;

function monthsAgoIso(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const idx = (m ?? 1) - 1 - months;
  const year = (y ?? 2000) + Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d ?? 1).padStart(2, '0')}`;
}

/**
 * 0–100 vehicle health score. Honest heuristic, not a diagnostic:
 * overdue items and neglect hurt the most, high mileage and recent big repairs a bit.
 */
export function healthScore(args: {
  vehicle: Vehicle;
  records: ServiceRecord[];
  reminders: Reminder[];
  today: string;
}): HealthResult {
  const { vehicle, records, reminders, today } = args;
  let score = 100;
  const reasons: string[] = [];

  const overdueCount = reminders.filter(
    (r) => reminderDueState(r, vehicle.mileage, today) === 'overdue',
  ).length;
  if (overdueCount > 0) {
    const penalty = Math.min(overdueCount * 15, 45);
    score -= penalty;
    reasons.push(`${overdueCount} overdue item${overdueCount > 1 ? 's' : ''}`);
  }

  const twelveMonthsAgo = monthsAgoIso(today, 12);
  const hasRecentService = records.some((r) => r.date >= twelveMonthsAgo);
  if (records.length === 0) {
    score -= 10;
    reasons.push('no service history yet');
  } else if (!hasRecentService) {
    score -= 10;
    reasons.push('no service in the last 12 months');
  }

  const ninetyDaysAgo = monthsAgoIso(today, 3);
  const bigRecentRepairs = records.filter(
    (r) =>
      serviceTypeDef(r.serviceType).kind === 'repair' &&
      (r.cost ?? 0) >= EXPENSIVE_REPAIR_THRESHOLD &&
      r.date >= ninetyDaysAgo,
  ).length;
  if (bigRecentRepairs > 0) {
    const penalty = Math.min(bigRecentRepairs * 10, 20);
    score -= penalty;
    reasons.push('recent expensive repair');
  }

  if (vehicle.mileage > 150_000) {
    score -= 10;
    reasons.push('high mileage');
  } else if (vehicle.mileage > 100_000) {
    score -= 5;
    reasons.push('above 100k miles');
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? 'Great' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention';
  return { score, label, reasons };
}
