import { nextOccurrence, todayIso } from '../domain/due';
import type { NewReminder, Reminder } from '../domain/types';
import { bumpDataVersion, getDb, newId, nowIso } from './database';

type ReminderRow = {
  id: string;
  vehicle_id: string;
  title: string;
  category: string;
  due_date: string | null;
  due_mileage: number | null;
  recurrence_type: string;
  recurrence_interval_months: number | null;
  recurrence_interval_miles: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: ReminderRow): Reminder {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    title: r.title,
    category: r.category,
    dueDate: r.due_date,
    dueMileage: r.due_mileage,
    recurrenceType: r.recurrence_type as Reminder['recurrenceType'],
    recurrenceIntervalMonths: r.recurrence_interval_months,
    recurrenceIntervalMiles: r.recurrence_interval_miles,
    status: r.status as Reminder['status'],
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listReminders(filter?: { vehicleId?: string; status?: Reminder['status'] }): Reminder[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter?.vehicleId) {
    clauses.push('vehicle_id = ?');
    params.push(filter.vehicleId);
  }
  if (filter?.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().getAllSync<ReminderRow>(
    `SELECT * FROM reminders ${where} ORDER BY due_date IS NULL, due_date ASC, due_mileage ASC`,
    params,
  );
  return rows.map(fromRow);
}

export function createReminder(input: NewReminder): Reminder {
  const id = newId();
  const ts = nowIso();
  getDb().runSync(
    `INSERT INTO reminders (id, vehicle_id, title, category, due_date, due_mileage,
       recurrence_type, recurrence_interval_months, recurrence_interval_miles,
       status, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.title,
      input.category,
      input.dueDate,
      input.dueMileage,
      input.recurrenceType,
      input.recurrenceIntervalMonths,
      input.recurrenceIntervalMiles,
      ts,
      ts,
    ],
  );
  bumpDataVersion();
  return { ...input, id, status: 'active', completedAt: null, createdAt: ts, updatedAt: ts };
}

/**
 * Complete a reminder. Recurring reminders roll forward to the next occurrence
 * (stay active with new dues); one-shot reminders are marked completed.
 */
export function completeReminder(reminder: Reminder, currentMileage: number) {
  const ts = nowIso();
  const next = nextOccurrence(reminder, { date: todayIso(), mileage: currentMileage });
  if (next) {
    getDb().runSync(
      'UPDATE reminders SET due_date = ?, due_mileage = ?, updated_at = ? WHERE id = ?',
      [next.dueDate, next.dueMileage, ts, reminder.id],
    );
  } else {
    getDb().runSync(
      "UPDATE reminders SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
      [ts, ts, reminder.id],
    );
  }
  bumpDataVersion();
}

export function deleteReminder(id: string) {
  getDb().runSync('DELETE FROM reminders WHERE id = ?', [id]);
  bumpDataVersion();
}
