import type { FuelEntry, NewFuelEntry } from '../domain/types';
import { enqueueChange } from '../sync/queue';
import { bumpDataVersion, getActiveWorkspace, getDb, newId, nowIso } from './database';

type FuelRow = {
  id: string; vehicle_id: string; date: string; mileage: number; gallons: number; total_cost: number;
  station: string | null; notes: string | null; full_tank: number; created_at: string; updated_at: string;
};
function fromRow(r: FuelRow): FuelEntry {
  return { id: r.id, vehicleId: r.vehicle_id, date: r.date, mileage: r.mileage, gallons: r.gallons,
    totalCost: r.total_cost, station: r.station, notes: r.notes, fullTank: r.full_tank === 1,
    createdAt: r.created_at, updatedAt: r.updated_at };
}
export function listFuelEntries(vehicleId?: string): FuelEntry[] {
  const workspace = getActiveWorkspace();
  const whereVehicle = vehicleId ? ' AND vehicle_id = ?' : '';
  const params = vehicleId ? [workspace, vehicleId] : [workspace];
  return getDb().getAllSync<FuelRow>(
    `SELECT * FROM fuel_entries WHERE workspace_id = ? AND deleted_at IS NULL${whereVehicle} ORDER BY date DESC, created_at DESC`, params,
  ).map(fromRow);
}
export function getFuelEntry(id: string): FuelEntry | null {
  const row = getDb().getFirstSync<FuelRow>(
    'SELECT * FROM fuel_entries WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL', [id, getActiveWorkspace()],
  );
  return row ? fromRow(row) : null;
}
export function createFuelEntry(input: NewFuelEntry): FuelEntry {
  const id = newId(); const ts = nowIso(); const workspace = getActiveWorkspace();
  getDb().runSync(
    `INSERT INTO fuel_entries (id,workspace_id,vehicle_id,date,mileage,gallons,total_cost,station,notes,full_tank,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, workspace, input.vehicleId, input.date, input.mileage, input.gallons, input.totalCost, input.station, input.notes, input.fullTank ? 1 : 0, ts, ts],
  );
  enqueueChange('fuel_entries', id); bumpDataVersion();
  return { ...input, id, createdAt: ts, updatedAt: ts };
}
export function updateFuelEntry(id: string, input: NewFuelEntry) {
  const ts = nowIso();
  getDb().runSync(
    `UPDATE fuel_entries SET vehicle_id=?,date=?,mileage=?,gallons=?,total_cost=?,station=?,notes=?,full_tank=?,updated_at=?
     WHERE id=? AND workspace_id=?`,
    [input.vehicleId,input.date,input.mileage,input.gallons,input.totalCost,input.station,input.notes,input.fullTank ? 1 : 0,ts,id,getActiveWorkspace()],
  );
  enqueueChange('fuel_entries', id); bumpDataVersion();
}
export function deleteFuelEntry(id: string) {
  const ts = nowIso();
  getDb().runSync('UPDATE fuel_entries SET deleted_at=?,updated_at=? WHERE id=? AND workspace_id=?',[ts,ts,id,getActiveWorkspace()]);
  enqueueChange('fuel_entries', id); bumpDataVersion();
}
