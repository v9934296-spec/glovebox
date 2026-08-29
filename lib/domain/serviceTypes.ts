/**
 * Service type catalog with sensible default intervals.
 * kind drives the repair-vs-maintenance expense split; intervals prefill "next due".
 *
 * `icon` is an Ionicons glyph name kept as a plain string so this file stays
 * free of React Native imports (it runs in the node test environment).
 */
export type ServiceKind = 'maintenance' | 'repair' | 'admin';

export type ServiceTypeDef = {
  id: string;
  label: string;
  kind: ServiceKind;
  defaultIntervalMiles: number | null;
  defaultIntervalMonths: number | null;
  icon: string;
};

export const SERVICE_TYPES: ServiceTypeDef[] = [
  { id: 'oil_change', label: 'Oil change', kind: 'maintenance', defaultIntervalMiles: 5000, defaultIntervalMonths: 6, icon: 'water-outline' },
  { id: 'tire_rotation', label: 'Tire rotation', kind: 'maintenance', defaultIntervalMiles: 6000, defaultIntervalMonths: 6, icon: 'sync-outline' },
  { id: 'brakes', label: 'Brakes', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: 12, icon: 'disc-outline' },
  { id: 'tires', label: 'Tires (new)', kind: 'maintenance', defaultIntervalMiles: 40000, defaultIntervalMonths: null, icon: 'ellipse-outline' },
  { id: 'battery', label: 'Battery', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: 36, icon: 'battery-charging-outline' },
  { id: 'repair', label: 'Repair (other)', kind: 'repair', defaultIntervalMiles: null, defaultIntervalMonths: null, icon: 'construct-outline' },
  { id: 'alignment', label: 'Alignment', kind: 'maintenance', defaultIntervalMiles: 12000, defaultIntervalMonths: null, icon: 'git-compare-outline' },
  { id: 'transmission', label: 'Transmission service', kind: 'maintenance', defaultIntervalMiles: 30000, defaultIntervalMonths: null, icon: 'cog-outline' },
  { id: 'coolant', label: 'Coolant flush', kind: 'maintenance', defaultIntervalMiles: null, defaultIntervalMonths: 24, icon: 'thermometer-outline' },
  { id: 'spark_plugs', label: 'Spark plugs', kind: 'maintenance', defaultIntervalMiles: 60000, defaultIntervalMonths: null, icon: 'flash-outline' },
  { id: 'air_filter', label: 'Air filter', kind: 'maintenance', defaultIntervalMiles: 12000, defaultIntervalMonths: 12, icon: 'funnel-outline' },
  { id: 'registration', label: 'Registration', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 12, icon: 'document-text-outline' },
  { id: 'insurance', label: 'Insurance', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 6, icon: 'shield-checkmark-outline' },
  { id: 'smog', label: 'Smog check', kind: 'admin', defaultIntervalMiles: null, defaultIntervalMonths: 24, icon: 'cloud-outline' },
  { id: 'other', label: 'Other', kind: 'maintenance', defaultIntervalMiles: null, defaultIntervalMonths: null, icon: 'ellipsis-horizontal-outline' },
];

const byId = new Map(SERVICE_TYPES.map((t) => [t.id, t]));
const catalogIndex = new Map(SERVICE_TYPES.map((t, i) => [t.id, i]));

export function serviceTypeDef(id: string): ServiceTypeDef {
  return (
    byId.get(id) ?? {
      id,
      label: id,
      kind: 'maintenance',
      defaultIntervalMiles: null,
      defaultIntervalMonths: null,
      icon: 'ellipsis-horizontal-outline',
    }
  );
}

export function serviceTypeLabel(id: string): string {
  return serviceTypeDef(id).label;
}

export function serviceTypeIcon(id: string): string {
  return serviceTypeDef(id).icon;
}

/**
 * Catalog ordered by how often this owner logs each type, falling back to the
 * hand-tuned catalog order. Pure so the picker's ordering is unit-testable.
 */
export function orderServiceTypes(recentTypeIds: readonly string[]): ServiceTypeDef[] {
  const freq = new Map<string, number>();
  for (const id of recentTypeIds) freq.set(id, (freq.get(id) ?? 0) + 1);
  return [...SERVICE_TYPES].sort((a, b) => {
    const byFreq = (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0);
    if (byFreq !== 0) return byFreq;
    return (catalogIndex.get(a.id) ?? 0) - (catalogIndex.get(b.id) ?? 0);
  });
}
