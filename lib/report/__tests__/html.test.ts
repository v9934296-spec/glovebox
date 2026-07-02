import type { Reminder, ServiceRecord, Vehicle } from '../../domain/types';
import { buildVehicleReportHtml, escapeHtml } from '../html';

const vehicle: Vehicle = {
  id: 'v1',
  nickname: 'Daily',
  make: 'Honda',
  model: 'Civic',
  year: 2019,
  trim: 'EX',
  vin: '2HGFC2F59KH000000',
  licensePlate: '7ABC123',
  mileage: 82000,
  purchaseDate: '2021-03-01',
  purchasePrice: 18500,
  photoUri: null,
  createdAt: '2021-03-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function record(overrides: Partial<ServiceRecord>): ServiceRecord {
  return {
    id: 'r1',
    vehicleId: 'v1',
    serviceType: 'oil_change',
    date: '2026-01-10',
    mileage: 80000,
    cost: 89.5,
    shopName: null,
    notes: null,
    receiptUri: null,
    nextDueDate: null,
    nextDueMileage: null,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

const reminders: Reminder[] = [];
const today = '2026-07-02';

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml(`<b>"Joe's" & Sons</b>`)).toBe('&lt;b&gt;&quot;Joe&#39;s&quot; &amp; Sons&lt;/b&gt;');
  });
});

describe('buildVehicleReportHtml', () => {
  it('includes vehicle identity, details, and totals', () => {
    const html = buildVehicleReportHtml({ vehicle, records: [record({})], reminders, today });
    expect(html).toContain('2019 Honda Civic');
    expect(html).toContain('2HGFC2F59KH000000');
    expect(html).toContain('82,000 mi');
    expect(html).toContain('$89.50');
    expect(html).toContain('Oil change');
  });

  it('sorts service history newest first', () => {
    const html = buildVehicleReportHtml({
      vehicle,
      records: [
        record({ id: 'old', date: '2024-05-01', serviceType: 'brakes' }),
        record({ id: 'new', date: '2026-02-01', serviceType: 'tires' }),
      ],
      reminders,
      today,
    });
    expect(html.indexOf('Tires (new)')).toBeLessThan(html.indexOf('Brakes'));
  });

  it('escapes user-entered shop names and notes', () => {
    const html = buildVehicleReportHtml({
      vehicle,
      records: [record({ shopName: '<script>alert(1)</script>', notes: 'Used 0W-20 & OEM filter' })],
      reminders,
      today,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('0W-20 &amp; OEM filter');
  });

  it('handles a vehicle with no records', () => {
    const html = buildVehicleReportHtml({ vehicle, records: [], reminders, today });
    expect(html).toContain('No service records');
    expect(html).toContain('Service history (0)');
  });

  it('shows em-dashes for missing optional details', () => {
    const bare: Vehicle = { ...vehicle, vin: null, licensePlate: null, purchaseDate: null, purchasePrice: null, trim: null };
    const html = buildVehicleReportHtml({ vehicle: bare, records: [], reminders, today });
    expect(html).toContain('—');
    expect(html).not.toContain('null');
  });
});
