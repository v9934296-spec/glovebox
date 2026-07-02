import { addMonthsIso, dueState, dueSummary, nextOccurrence } from '../due';
import type { Reminder } from '../types';

const TODAY = '2026-07-01';

function reminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    vehicleId: 'v1',
    title: 'Oil change',
    category: 'oil_change',
    dueDate: null,
    dueMileage: null,
    recurrenceType: 'none',
    recurrenceIntervalMonths: null,
    recurrenceIntervalMiles: null,
    status: 'active',
    completedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('dueState', () => {
  it('returns no_due without targets', () => {
    expect(dueState({ dueDate: null, dueMileage: null, currentMileage: 50000, today: TODAY })).toBe('no_due');
  });

  it('flags overdue by date', () => {
    expect(dueState({ dueDate: '2026-06-30', dueMileage: null, currentMileage: 0, today: TODAY })).toBe('overdue');
  });

  it('flags due_soon within 14 days', () => {
    expect(dueState({ dueDate: '2026-07-10', dueMileage: null, currentMileage: 0, today: TODAY })).toBe('due_soon');
  });

  it('flags upcoming beyond 14 days', () => {
    expect(dueState({ dueDate: '2026-09-01', dueMileage: null, currentMileage: 0, today: TODAY })).toBe('upcoming');
  });

  it('flags overdue by mileage', () => {
    expect(dueState({ dueDate: null, dueMileage: 49000, currentMileage: 50000, today: TODAY })).toBe('overdue');
  });

  it('flags due_soon within 500 miles', () => {
    expect(dueState({ dueDate: null, dueMileage: 50400, currentMileage: 50000, today: TODAY })).toBe('due_soon');
  });

  it('most urgent of date and mileage wins', () => {
    expect(
      dueState({ dueDate: '2026-12-01', dueMileage: 49000, currentMileage: 50000, today: TODAY }),
    ).toBe('overdue');
  });
});

describe('dueSummary', () => {
  it('describes both dimensions', () => {
    const s = dueSummary({ dueDate: '2026-07-10', dueMileage: 50800, currentMileage: 50000, today: TODAY });
    expect(s).toBe('in 9d · 800 mi left');
  });

  it('describes overdue', () => {
    const s = dueSummary({ dueDate: '2026-06-28', dueMileage: null, currentMileage: 0, today: TODAY });
    expect(s).toBe('overdue by 3d');
  });
});

describe('addMonthsIso', () => {
  it('adds months', () => {
    expect(addMonthsIso('2026-07-01', 6)).toBe('2027-01-01');
  });

  it('clamps end of month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('nextOccurrence', () => {
  it('returns null for non-recurring', () => {
    expect(nextOccurrence(reminder({}), { date: TODAY, mileage: 50000 })).toBeNull();
  });

  it('computes both date and mileage recurrence from completion point', () => {
    const r = reminder({
      recurrenceType: 'both',
      recurrenceIntervalMonths: 6,
      recurrenceIntervalMiles: 5000,
    });
    expect(nextOccurrence(r, { date: '2026-07-01', mileage: 50000 })).toEqual({
      dueDate: '2027-01-01',
      dueMileage: 55000,
    });
  });

  it('mileage-only recurrence has null date', () => {
    const r = reminder({ recurrenceType: 'mileage', recurrenceIntervalMiles: 6000 });
    expect(nextOccurrence(r, { date: TODAY, mileage: 40000 })).toEqual({
      dueDate: null,
      dueMileage: 46000,
    });
  });
});
