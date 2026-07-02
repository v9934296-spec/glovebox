/**
 * Pure HTML builder for the PDF vehicle history report (unit tested, no RN
 * imports). expo-print turns this into the PDF; keep the styling inline and
 * print-friendly (light background, system fonts, page margins via @page).
 */
import { formatMoney, summarizeExpenses } from '../domain/expenses';
import { healthScore } from '../domain/healthScore';
import { serviceTypeLabel } from '../domain/serviceTypes';
import type { Reminder, ServiceRecord, Vehicle } from '../domain/types';

/** Escape user-entered text before it lands in markup. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string): string {
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

function miles(n: number): string {
  return `${n.toLocaleString('en-US')} mi`;
}

export type ReportInput = {
  vehicle: Vehicle;
  records: ServiceRecord[];
  /** Active reminders, used for the health score and the upcoming section. */
  reminders: Reminder[];
  today: string;
};

export function buildVehicleReportHtml({ vehicle, records, reminders, today }: ReportInput): string {
  const health = healthScore({ vehicle, records, reminders, today });
  const expenses = summarizeExpenses(records, today);
  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const historyRows = sorted
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(serviceTypeLabel(r.serviceType))}</td>
        <td>${r.mileage != null ? escapeHtml(miles(r.mileage)) : ''}</td>
        <td>${escapeHtml(r.shopName ?? '')}</td>
        <td class="num">${r.cost != null ? escapeHtml(formatMoney(r.cost)) : ''}</td>
      </tr>
      ${r.notes ? `<tr class="notes"><td></td><td colspan="4">${escapeHtml(r.notes)}</td></tr>` : ''}`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 36px; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c2128; font-size: 12px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin: 28px 0 8px; }
  .meta { color: #6b7280; margin-top: 4px; }
  .brand { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #F5A524; padding-bottom: 12px; }
  .brand .app { font-weight: 700; color: #b97a0a; }
  .grid { display: flex; gap: 12px; margin-top: 12px; }
  .tile { flex: 1; border: 1px solid #e2e5ea; border-radius: 8px; padding: 10px 12px; }
  .tile .k { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
  .tile .v { font-size: 16px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eceff3; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; }
  td.label { color: #6b7280; width: 35%; }
  td.num, th.num { text-align: right; }
  tr.notes td { color: #6b7280; font-size: 11px; border-bottom: 1px solid #eceff3; padding-top: 0; }
  .footer { margin-top: 32px; color: #9aa1ab; font-size: 10px; }
</style>
</head>
<body>
  <div class="brand">
    <div>
      <h1>${escapeHtml(vehicleName)}</h1>
      <div class="meta">Vehicle history report${vehicle.trim ? ` · ${escapeHtml(vehicle.trim)}` : ''}</div>
    </div>
    <div class="app">GLOVEBOX</div>
  </div>

  <div class="grid">
    <div class="tile"><div class="k">Odometer</div><div class="v">${escapeHtml(miles(vehicle.mileage))}</div></div>
    <div class="tile"><div class="k">Health score</div><div class="v">${health.score} · ${escapeHtml(health.label)}</div></div>
    <div class="tile"><div class="k">Records</div><div class="v">${records.length}</div></div>
    <div class="tile"><div class="k">Lifetime spend</div><div class="v">${escapeHtml(formatMoney(expenses.lifetimeTotal))}</div></div>
  </div>

  <h2>Vehicle details</h2>
  <table>
    ${row('VIN', vehicle.vin ?? '—')}
    ${row('License plate', vehicle.licensePlate ?? '—')}
    ${row('Purchased', vehicle.purchaseDate ?? '—')}
    ${row('Purchase price', vehicle.purchasePrice != null ? formatMoney(vehicle.purchasePrice) : '—')}
  </table>

  <h2>Cost of ownership</h2>
  <table>
    ${row('This year', formatMoney(expenses.yearTotal))}
    ${row('Maintenance (lifetime)', formatMoney(expenses.maintenanceTotal))}
    ${row('Repairs (lifetime)', formatMoney(expenses.repairTotal))}
    ${row('Registration & admin (lifetime)', formatMoney(expenses.adminTotal))}
    ${row('Cost per mile', expenses.costPerMile != null ? `$${expenses.costPerMile.toFixed(2)}` : '—')}
  </table>

  <h2>Service history (${records.length})</h2>
  ${
    records.length === 0
      ? '<p class="meta">No service records.</p>'
      : `<table>
    <tr><th>Date</th><th>Service</th><th>Mileage</th><th>Shop</th><th class="num">Cost</th></tr>
    ${historyRows}
  </table>`
  }

  <div class="footer">
    Generated by Glovebox on ${escapeHtml(today)}. Health score is a maintenance heuristic based on the owner's
    records, not a mechanical inspection.
  </div>
</body>
</html>`;
}
