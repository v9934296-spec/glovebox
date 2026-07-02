/**
 * Service type catalog with sensible default intervals.
 * kind drives the repair-vs-maintenance expense split; intervals prefill "next due".
 */
export type ServiceKind = 'maintenance' | 'repair' | 'admin';

export type ServiceTypeDef = {
  id: string;
  label: string;
  kind: ServiceKind;
  defaultIntervalMiles: number | null;
  defaultIntervalMonths: number | null;
};

export const SERVICE_TYPES: ServiceTypeDef[] = [
  { id: 'oil_change', label: 'Oil change', kind: 'maintenance', defaultIntervalMiles: 5000, defaultIntervalMonths: 6 },
  { id: 'tire_rotation', label: 'Tire rotation', kind: 'maintenance', defaultIntervalMiles: 6000, defaultIntervalMonths: 6 },
  { id: 'tires', label: 'Tires (new)', kind: 'maintenance', defaultIntervalMiles: 40000, defaultIntervalMonths: null },
  { id: 'brakes', label: 'Brakes', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: 12 },
  { id: 'battery', label: 'Battery', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: 36 },
  { id: 'alignment', label: 'Alignment', kind: 'maintenance', defaultIntervalMiles: 12000, defaultIntervalMonths: null },
  { id: 'transmission', label: 'Transmission service', kind: 'maintenance', defaultIntervalMiles: 30000, defaultIntervalMonths: null },
  { id: 'coolant', label: 'Coolant flush', kind: 'maintenance', defaultIntervalMiles: null, defaultIntervalMonths: 24 },
  { id: 'spark_plugs', label: 'Spark plugs', kind: 'maintenance', defaultIntervalMiles: 60000, defaultIntervalMonths: null },
  { id: 'air_filter', label: 'Air filter', kind: 'maintenance', defaultIntervalMiles: 12000, defaultIntervalMonths: 12 },
  { id: 'registration', label: 'Registration', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 12 },
  { id: 'insurance', label: 'Insurance', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 6 },
  { id: 'smog', label: 'Smog check', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 24 },
  { id: 'repair', label: 'Repair (other)', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: null },
  { id: 'other', label: 'Other', kind: 'maintenance', defaultIntervalMiles: null, defaultIntervalMonths: null },
];

const byId = new Map(SERVICE_TYPES.map((t) => [t.id, t]));

export function serviceTypeDef(id: string): ServiceTypeDef {
  return byId.get(id) ?? { id, label: id, kind: 'maintenance', defaultIntervalMiles: null, defaultIntervalMonths: null };
}

export function serviceTypeLabel(id: string): string {
  return serviceTypeDef(id).label;
}
