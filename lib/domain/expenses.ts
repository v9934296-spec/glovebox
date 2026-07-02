import { serviceTypeDef } from './serviceTypes';
import type { ServiceRecord } from './types';

export type ExpenseSummary = {
  monthTotal: number;
  yearTotal: number;
  lifetimeTotal: number;
  costPerMile: number | null;
  byCategory: Array<{ serviceType: string; total: number }>;
  maintenanceTotal: number;
  repairTotal: number;
  adminTotal: number;
};

function cost(r: ServiceRecord): number {
  return r.cost ?? 0;
}

/**
 * Aggregate spend from service records. Cost per mile uses the mileage span
 * covered by records (needs 2+ records with mileage), not raw odometer.
 */
export function summarizeExpenses(records: ServiceRecord[], today: string): ExpenseSummary {
  const [yearStr, monthStr] = today.split('-');
  const monthPrefix = `${yearStr}-${monthStr}`;
  const yearPrefix = `${yearStr}-`;

  let monthTotal = 0;
  let yearTotal = 0;
  let lifetimeTotal = 0;
  let maintenanceTotal = 0;
  let repairTotal = 0;
  let adminTotal = 0;
  const categoryTotals = new Map<string, number>();
  const mileages: number[] = [];

  for (const r of records) {
    const c = cost(r);
    lifetimeTotal += c;
    if (r.date.startsWith(yearPrefix)) yearTotal += c;
    if (r.date.startsWith(monthPrefix)) monthTotal += c;

    const kind = serviceTypeDef(r.serviceType).kind;
    if (kind === 'repair') repairTotal += c;
    else if (kind === 'admin') adminTotal += c;
    else maintenanceTotal += c;

    categoryTotals.set(r.serviceType, (categoryTotals.get(r.serviceType) ?? 0) + c);
    if (r.mileage != null) mileages.push(r.mileage);
  }

  let costPerMile: number | null = null;
  if (mileages.length >= 2) {
    const span = Math.max(...mileages) - Math.min(...mileages);
    if (span > 0) costPerMile = lifetimeTotal / span;
  }

  const byCategory = [...categoryTotals.entries()]
    .map(([serviceType, total]) => ({ serviceType, total }))
    .sort((a, b) => b.total - a.total);

  return {
    monthTotal,
    yearTotal,
    lifetimeTotal,
    costPerMile,
    byCategory,
    maintenanceTotal,
    repairTotal,
    adminTotal,
  };
}

export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}
