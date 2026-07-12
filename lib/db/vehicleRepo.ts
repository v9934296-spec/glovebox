import type { DecodedVin, NewVehicle, Recall, Vehicle } from '../domain/types';
import { enqueueChange } from '../sync/queue';
import { bumpDataVersion, getDb, newId, nowIso } from './database';

type VehicleRow = {
  id: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  vin: string | null;
  license_plate: string | null;
  mileage: number;
  purchase_date: string | null;
  purchase_price: number | null;
  photo_uri: string | null;
  vin_decoded_at: string | null;
  vin_decode_json: string | null;
  recall_checked_at: string | null;
  recall_json: string | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fromRow(r: VehicleRow): Vehicle {
  return {
    id: r.id,
    nickname: r.nickname,
    make: r.make,
    model: r.model,
    year: r.year,
    trim: r.trim,
    vin: r.vin,
    licensePlate: r.license_plate,
    mileage: r.mileage,
    purchaseDate: r.purchase_date,
    purchasePrice: r.purchase_price,
    photoUri: r.photo_uri,
    vinDecodedAt: r.vin_decoded_at,
    vinDecoded: parseJson<DecodedVin | null>(r.vin_decode_json, null),
    recallCheckedAt: r.recall_checked_at,
    recalls: parseJson<Recall[]>(r.recall_json, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listVehicles(): Vehicle[] {
  const rows = getDb().getAllSync<VehicleRow>(
    'SELECT * FROM vehicles WHERE deleted_at IS NULL ORDER BY created_at ASC',
  );
  return rows.map(fromRow);
}

export function getVehicle(id: string): Vehicle | null {
  const row = getDb().getFirstSync<VehicleRow>(
    'SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? fromRow(row) : null;
}

export function createVehicle(input: NewVehicle): Vehicle {
  const id = newId();
  const ts = nowIso();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO vehicles (id, nickname, make, model, year, trim, vin, license_plate, mileage,
         purchase_date, purchase_price, photo_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.nickname,
        input.make,
        input.model,
        input.year,
        input.trim,
        input.vin,
        input.licensePlate,
        input.mileage,
        input.purchaseDate,
        input.purchasePrice,
        input.photoUri,
        ts,
        ts,
      ],
    );
    enqueueChange('vehicles', id);
  });
  bumpDataVersion();
  return {
    ...input,
    id,
    vinDecodedAt: null,
    vinDecoded: null,
    recallCheckedAt: null,
    recalls: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function updateVehicleMileage(id: string, mileage: number) {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('UPDATE vehicles SET mileage = ?, updated_at = ? WHERE id = ?', [mileage, nowIso(), id]);
    enqueueChange('vehicles', id);
  });
  bumpDataVersion();
}

/** Persists a successful VIN decode; the VIN itself is normalized/validated on-device first. */
export function updateVehicleVinDecode(id: string, vin: string, decoded: DecodedVin) {
  const ts = nowIso();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      'UPDATE vehicles SET vin = ?, vin_decoded_at = ?, vin_decode_json = ?, updated_at = ? WHERE id = ?',
      [vin, ts, JSON.stringify(decoded), ts, id],
    );
    enqueueChange('vehicles', id);
  });
  bumpDataVersion();
}

/** Persists a recall check result. An empty array with a fresh timestamp means "checked, none open". */
export function updateVehicleRecalls(id: string, recalls: Recall[]) {
  const ts = nowIso();
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      'UPDATE vehicles SET recall_checked_at = ?, recall_json = ?, updated_at = ? WHERE id = ?',
      [ts, JSON.stringify(recalls), ts, id],
    );
    enqueueChange('vehicles', id);
  });
  bumpDataVersion();
}

/** Soft delete so the deletion syncs to other devices; children go with it. */
export function deleteVehicle(id: string) {
  const db = getDb();
  const ts = nowIso();
  const children = {
    service_records: db.getAllSync<{ id: string }>(
      'SELECT id FROM service_records WHERE vehicle_id = ? AND deleted_at IS NULL',
      [id],
    ),
    reminders: db.getAllSync<{ id: string }>(
      'SELECT id FROM reminders WHERE vehicle_id = ? AND deleted_at IS NULL',
      [id],
    ),
  };
  db.withTransactionSync(() => {
    db.runSync('UPDATE vehicles SET deleted_at = ?, updated_at = ? WHERE id = ?', [ts, ts, id]);
    db.runSync(
      'UPDATE service_records SET deleted_at = ?, updated_at = ? WHERE vehicle_id = ? AND deleted_at IS NULL',
      [ts, ts, id],
    );
    db.runSync(
      'UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE vehicle_id = ? AND deleted_at IS NULL',
      [ts, ts, id],
    );
    enqueueChange('vehicles', id);
    for (const r of children.service_records) enqueueChange('service_records', r.id);
    for (const r of children.reminders) enqueueChange('reminders', r.id);
  });
  bumpDataVersion();
}
