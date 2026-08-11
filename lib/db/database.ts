import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import { deleteLocalMedia } from '../media/local';

let db: SQLiteDatabase | null = null;
export const LOCAL_WORKSPACE = 'local';
let activeWorkspace = LOCAL_WORKSPACE;

const SCHEMA_VERSION = 4;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY, nickname TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL,
      year INTEGER NOT NULL, trim TEXT, vin TEXT, license_plate TEXT, mileage INTEGER NOT NULL DEFAULT 0,
      purchase_date TEXT, purchase_price REAL, photo_uri TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL, date TEXT NOT NULL, mileage INTEGER, cost REAL, shop_name TEXT,
      notes TEXT, receipt_uri TEXT, next_due_date TEXT, next_due_mileage INTEGER,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_vehicle_date ON service_records(vehicle_id, date DESC);
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', due_date TEXT, due_mileage INTEGER,
      recurrence_type TEXT NOT NULL DEFAULT 'none', recurrence_interval_months INTEGER,
      recurrence_interval_miles INTEGER, status TEXT NOT NULL DEFAULT 'active', completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_vehicle_status ON reminders(vehicle_id, status);
  `,
  2: `
    ALTER TABLE vehicles ADD COLUMN deleted_at TEXT;
    ALTER TABLE service_records ADD COLUMN deleted_at TEXT;
    ALTER TABLE reminders ADD COLUMN deleted_at TEXT;
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT NOT NULL, queued_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_row ON sync_queue(table_name, row_id);
    CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  3: `
    ALTER TABLE vehicles ADD COLUMN vin_decoded_at TEXT;
    ALTER TABLE vehicles ADD COLUMN vin_decode_json TEXT;
    ALTER TABLE vehicles ADD COLUMN recall_checked_at TEXT;
    ALTER TABLE vehicles ADD COLUMN recall_json TEXT;
  `,
  4: `
    ALTER TABLE vehicles ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE service_records ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE reminders ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE sync_queue ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local';

    CREATE INDEX IF NOT EXISTS idx_vehicles_workspace ON vehicles(workspace_id, deleted_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_service_workspace ON service_records(workspace_id, vehicle_id, deleted_at, date DESC);
    CREATE INDEX IF NOT EXISTS idx_reminders_workspace ON reminders(workspace_id, vehicle_id, status, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_workspace ON sync_queue(workspace_id, table_name, row_id);

    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'local',
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      mileage INTEGER NOT NULL CHECK(mileage >= 0),
      gallons REAL NOT NULL CHECK(gallons > 0),
      total_cost REAL NOT NULL CHECK(total_cost >= 0),
      station TEXT,
      notes TEXT,
      full_tank INTEGER NOT NULL DEFAULT 1 CHECK(full_tank IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fuel_workspace_vehicle_date ON fuel_entries(workspace_id, vehicle_id, deleted_at, date DESC);
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

export function userWorkspaceId(userId: string): string { return `user:${userId}`; }
export function getActiveWorkspace(): string { return activeWorkspace; }
export function setActiveWorkspace(workspaceId: string) {
  if (activeWorkspace === workspaceId) return;
  activeWorkspace = workspaceId;
  bumpDataVersion();
}

export function workspaceHasData(workspaceId: string): boolean {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT (
      (SELECT COUNT(*) FROM vehicles WHERE workspace_id = ? AND deleted_at IS NULL) +
      (SELECT COUNT(*) FROM service_records WHERE workspace_id = ? AND deleted_at IS NULL) +
      (SELECT COUNT(*) FROM reminders WHERE workspace_id = ? AND deleted_at IS NULL) +
      (SELECT COUNT(*) FROM fuel_entries WHERE workspace_id = ? AND deleted_at IS NULL)
    ) AS n`,
    [workspaceId, workspaceId, workspaceId, workspaceId],
  );
  return (row?.n ?? 0) > 0;
}

export function moveWorkspaceData(from: string, to: string) {
  if (from === to) return;
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync('UPDATE vehicles SET workspace_id = ? WHERE workspace_id = ?', [to, from]);
    database.runSync('UPDATE service_records SET workspace_id = ? WHERE workspace_id = ?', [to, from]);
    database.runSync('UPDATE reminders SET workspace_id = ? WHERE workspace_id = ?', [to, from]);
    database.runSync('UPDATE fuel_entries SET workspace_id = ? WHERE workspace_id = ?', [to, from]);
    database.runSync('UPDATE sync_queue SET workspace_id = ? WHERE workspace_id = ?', [to, from]);
  });
  bumpDataVersion();
}

export function resetUserSyncProgress(userId: string) {
  const database = getDb();
  database.runSync(
    'DELETE FROM sync_state WHERE key = ? OR key = ? OR key LIKE ?',
    [`backfilled:${userId}`, `lastSyncedAt:${userId}`, `cursor:%:${userId}`],
  );
}

export function clearUserSyncState(userId: string) { getDb().runSync('DELETE FROM sync_state WHERE key LIKE ?', [`%:${userId}`]); }

export function clearWorkspaceData(workspaceId = activeWorkspace) {
  const database = getDb();
  const media = [
    ...database.getAllSync<{ uri: string | null }>('SELECT photo_uri AS uri FROM vehicles WHERE workspace_id = ?', [workspaceId]),
    ...database.getAllSync<{ uri: string | null }>('SELECT receipt_uri AS uri FROM service_records WHERE workspace_id = ?', [workspaceId]),
  ];
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM reminders WHERE workspace_id = ?', [workspaceId]);
    database.runSync('DELETE FROM fuel_entries WHERE workspace_id = ?', [workspaceId]);
    database.runSync('DELETE FROM service_records WHERE workspace_id = ?', [workspaceId]);
    database.runSync('DELETE FROM vehicles WHERE workspace_id = ?', [workspaceId]);
    database.runSync('DELETE FROM sync_queue WHERE workspace_id = ?', [workspaceId]);
  });
  if (workspaceId.startsWith('user:')) resetUserSyncProgress(workspaceId.slice('user:'.length));
  for (const item of media) deleteLocalMedia(item.uri);
  bumpDataVersion();
}

export function resetAllData() { clearWorkspaceData(); }
export function newId(): string { const rand = () => Math.random().toString(36).slice(2, 10); return `${Date.now().toString(36)}-${rand()}-${rand()}`; }
export function nowIso(): string { return new Date().toISOString(); }

type DataVersionState = { version: number; bump: () => void };
export const useDataVersion = create<DataVersionState>((set) => ({ version: 0, bump: () => set((s) => ({ version: s.version + 1 })) }));
export function bumpDataVersion() { useDataVersion.getState().bump(); }
