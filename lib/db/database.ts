import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

let db: SQLiteDatabase | null = null;

const SCHEMA_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      trim TEXT,
      vin TEXT,
      license_plate TEXT,
      mileage INTEGER NOT NULL DEFAULT 0,
      purchase_date TEXT,
      purchase_price REAL,
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      date TEXT NOT NULL,
      mileage INTEGER,
      cost REAL,
      shop_name TEXT,
      notes TEXT,
      receipt_uri TEXT,
      next_due_date TEXT,
      next_due_mileage INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_vehicle_date ON service_records(vehicle_id, date DESC);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      due_date TEXT,
      due_mileage INTEGER,
      recurrence_type TEXT NOT NULL DEFAULT 'none',
      recurrence_interval_months INTEGER,
      recurrence_interval_miles INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_vehicle_status ON reminders(vehicle_id, status);
  `,
};

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('glovebox.db');
    db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(db);
  }
  return db;
}

function migrate(database: SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < SCHEMA_VERSION) {
    const next = version + 1;
    const sql = MIGRATIONS[next];
    if (!sql) throw new Error(`Missing migration for schema version ${next}`);
    database.withTransactionSync(() => {
      database.execSync(sql);
      database.execSync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

/** Wipe all user data (Settings → reset). Keeps schema. */
export function resetAllData() {
  const database = getDb();
  database.withTransactionSync(() => {
    database.execSync('DELETE FROM reminders; DELETE FROM service_records; DELETE FROM vehicles;');
  });
  bumpDataVersion();
}

export function newId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Repos bump this after every write; hooks subscribe so screens refetch.
 * Simplest possible invalidation for a local-only Phase 1.
 */
type DataVersionState = { version: number; bump: () => void };
export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function bumpDataVersion() {
  useDataVersion.getState().bump();
}
