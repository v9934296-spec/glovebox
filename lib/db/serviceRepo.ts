import type { NewServiceRecord, ServiceRecord } from '../domain/types';
import { bumpDataVersion, getDb, newId, nowIso } from './database';

type ServiceRow = {
  id: string;
  vehicle_id: string;
  service_type: string;
  date: string;
  mileage: number | null;
  cost: number | null;
  shop_name: string | null;
  notes: string | null;
  receipt_uri: string | null;
  next_due_date: string | null;
  next_due_mileage: number | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: ServiceRow): ServiceRecord {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    serviceType: r.service_type,
    date: r.date,
    mileage: r.mileage,
    cost: r.cost,
    shopName: r.shop_name,
    notes: r.notes,
    receiptUri: r.receipt_uri,
    nextDueDate: r.next_due_date,
    nextDueMileage: r.next_due_mileage,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listServiceRecords(vehicleId: string): ServiceRecord[] {
  const rows = getDb().getAllSync<ServiceRow>(
    'SELECT * FROM service_records WHERE vehicle_id = ? ORDER BY date DESC, created_at DESC',
    [vehicleId],
  );
  return rows.map(fromRow);
}

export function listAllServiceRecords(): ServiceRecord[] {
  const rows = getDb().getAllSync<ServiceRow>('SELECT * FROM service_records ORDER BY date DESC');
  return rows.map(fromRow);
}

export function createServiceRecord(input: NewServiceRecord): ServiceRecord {
  const id = newId();
  const ts = nowIso();
  getDb().runSync(
    `INSERT INTO service_records (id, vehicle_id, service_type, date, mileage, cost, shop_name,
       notes, receipt_uri, next_due_date, next_due_mileage, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.serviceType,
      input.date,
      input.mileage,
      input.cost,
      input.shopName,
      input.notes,
      input.receiptUri,
      input.nextDueDate,
      input.nextDueMileage,
      ts,
      ts,
    ],
  );
  bumpDataVersion();
  return { ...input, id, createdAt: ts, updatedAt: ts };
}

export function deleteServiceRecord(id: string) {
  getDb().runSync('DELETE FROM service_records WHERE id = ?', [id]);
  bumpDataVersion();
}
