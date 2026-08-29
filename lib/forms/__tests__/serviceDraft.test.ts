import { orderServiceTypes } from '../../domain/serviceTypes';
import { draftCost, draftMileage, resolveNextDue, type DraftSnapshot } from '../serviceDraft';

function draft(overrides: Partial<DraftSnapshot> = {}): DraftSnapshot {
  return {
    serviceType: 'oil_change',
    date: '2026-08-15',
    mileage: '84210',
    cost: '78.40',
    shopName: '',
    notes: '',
    receiptUri: null,
    nextDueOverride: null,
    ...overrides,
  };
}

describe('draftCost', () => {
  it('parses a plain decimal', () => {
    expect(draftCost(draft({ cost: '78.40' }))).toBe(78.4);
  });

  it('returns null for blank input', () => {
    expect(draftCost(draft({ cost: '   ' }))).toBeNull();
  });

  it('rejects malformed numbers instead of yielding NaN', () => {
    expect(draftCost(draft({ cost: '1.2.3' }))).toBeNull();
  });
});

describe('draftMileage', () => {
  it('rounds to a whole odometer reading', () => {
    expect(draftMileage(draft({ mileage: '84210' }))).toBe(84210);
  });

  it('returns null when blank', () => {
    expect(draftMileage(draft({ mileage: '' }))).toBeNull();
  });
});

describe('resolveNextDue', () => {
  it('derives both targets from the service interval', () => {
    expect(resolveNextDue(draft())).toEqual({ dueDate: '2027-02-15', dueMileage: 89210 });
  });

  it('omits the mileage target when the odometer is blank', () => {
    expect(resolveNextDue(draft({ mileage: '' }))).toEqual({ dueDate: '2027-02-15', dueMileage: null });
  });

  it('yields nothing for a type with no default interval', () => {
    expect(resolveNextDue(draft({ serviceType: 'other' }))).toEqual({ dueDate: null, dueMileage: null });
  });

  it('prefers an explicit owner override', () => {
    const override = { dueDate: '2027-01-01', dueMileage: 90000 };
    expect(resolveNextDue(draft({ nextDueOverride: override }))).toEqual(override);
  });

  it('honours an override that clears the reminder', () => {
    const override = { dueDate: null, dueMileage: null };
    expect(resolveNextDue(draft({ nextDueOverride: override }))).toEqual(override);
  });
});

describe('orderServiceTypes', () => {
  it('floats the most-logged types to the front', () => {
    const ordered = orderServiceTypes(['brakes', 'brakes', 'brakes', 'smog']);
    expect(ordered[0]?.id).toBe('brakes');
  });

  it('falls back to catalog order with no history', () => {
    expect(orderServiceTypes([])[0]?.id).toBe('oil_change');
  });

  it('always returns the whole catalog', () => {
    expect(orderServiceTypes(['brakes'])).toHaveLength(15);
  });
});
