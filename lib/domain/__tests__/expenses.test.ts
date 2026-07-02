import { formatMoney, summarizeExpenses } from '../expenses';
import type { ServiceRecord } from '../types';

const TODAY = '2026-07-15';

function record(overrides: Partial<ServiceRecord>): ServiceRecord {
  return {
    id: Math.random().toString(36).slice(2),
    vehicleId: 'v1',
    serviceType: 'oil_change',
    date: '2026-07-01',
    mileage: null,
    cost: null,
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

describe('summarizeExpenses', () => {
  it('handles empty records', () => {
    const s = summarizeExpenses([], TODAY);
    expect(s.lifetimeTotal).toBe(0);
    expect(s.costPerMile).toBeNull();
    expect(s.byCategory).toEqual([]);
  });

  it('splits month, year, lifetime', () => {
    const s = summarizeExpenses(
      [
        record({ date: '2026-07-02', cost: 80 }),
        record({ date: '2026-03-10', cost: 200 }),
        record({ date: '2025-11-01', cost: 500 }),
      ],
      TODAY,
    );
    expect(s.monthTotal).toBe(80);
    expect(s.yearTotal).toBe(280);
    expect(s.lifetimeTotal).toBe(780);
  });

  it('computes cost per mile over the recorded span', () => {
    const s = summarizeExpenses(
      [
        record({ date: '2026-01-01', cost: 100, mileage: 50000 }),
        record({ date: '2026-06-01', cost: 300, mileage: 55000 }),
      ],
      TODAY,
    );
    expect(s.costPerMile).toBeCloseTo(0.08);
  });

  it('splits repair vs maintenance vs admin', () => {
    const s = summarizeExpenses(
      [
        record({ serviceType: 'oil_change', cost: 80 }),
        record({ serviceType: 'brakes', cost: 900 }),
        record({ serviceType: 'registration', cost: 150 }),
      ],
      TODAY,
    );
    expect(s.maintenanceTotal).toBe(80);
    expect(s.repairTotal).toBe(900);
    expect(s.adminTotal).toBe(150);
  });

  it('sorts categories by spend', () => {
    const s = summarizeExpenses(
      [
        record({ serviceType: 'oil_change', cost: 80 }),
        record({ serviceType: 'brakes', cost: 900 }),
        record({ serviceType: 'oil_change', cost: 90 }),
      ],
      TODAY,
    );
    expect(s.byCategory[0]).toEqual({ serviceType: 'brakes', total: 900 });
    expect(s.byCategory[1]).toEqual({ serviceType: 'oil_change', total: 170 });
  });
});

describe('formatMoney', () => {
  it('formats whole dollars without cents', () => {
    expect(formatMoney(1200)).toBe('$1,200');
  });
});
