import { healthScore } from '../healthScore';
import type { Reminder, ServiceRecord, Vehicle } from '../types';

const TODAY = '2026-07-01';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    nickname: 'Daily',
    make: 'Honda',
    model: 'Civic',
    year: 2015,
    trim: null,
    vin: null,
    licensePlate: null,
    mileage: 80000,
    purchaseDate: null,
    purchasePrice: null,
    photoUri: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: Math.random().toString(36).slice(2),
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

function record(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: Math.random().toString(36).slice(2),
    vehicleId: 'v1',
    serviceType: 'oil_change',
    date: '2026-06-01',
    mileage: 79000,
    cost: 80,
    shopName: null,
    notes: null,
    receiptUri: null,
    nextDueDate: null,
    nextDueMileage: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('healthScore', () => {
  it('well-maintained vehicle scores Great', () => {
    const r = healthScore({ vehicle: vehicle(), records: [record()], reminders: [], today: TODAY });
    expect(r.score).toBe(100);
    expect(r.label).toBe('Great');
  });

  it('penalizes overdue reminders, capped', () => {
    const overdue = [1, 2, 3, 4].map(() => reminder({ dueDate: '2026-01-01' }));
    const r = healthScore({ vehicle: vehicle(), records: [record()], reminders: overdue, today: TODAY });
    expect(r.score).toBe(55);
    expect(r.reasons).toContain('4 overdue items');
  });

  it('penalizes no service history', () => {
    const r = healthScore({ vehicle: vehicle(), records: [], reminders: [], today: TODAY });
    expect(r.score).toBe(90);
    expect(r.reasons).toContain('no service history yet');
  });

  it('penalizes high mileage and recent expensive repair', () => {
    const r = healthScore({
      vehicle: vehicle({ mileage: 160000 }),
      records: [record({ serviceType: 'brakes', cost: 1500, date: '2026-06-20' })],
      reminders: [],
      today: TODAY,
    });
    expect(r.score).toBe(80);
    expect(r.reasons).toEqual(expect.arrayContaining(['recent expensive repair', 'high mileage']));
  });

  it('never goes below 0', () => {
    const overdue = [1, 2, 3].map(() => reminder({ dueDate: '2025-01-01' }));
    const r = healthScore({
      vehicle: vehicle({ mileage: 200000 }),
      records: [],
      reminders: overdue,
      today: TODAY,
    });
    expect(r.score).toBe(35);
    expect(r.label).toBe('Needs attention');
  });
});
