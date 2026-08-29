import { getDb, nowIso } from '../db/database';

export const SYNC_TABLES = ['vehicles', 'service_records', 'reminders'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

let onEnqueued: (() => void) | null = null;

/** The sync engine registers here so writes can schedule a debounced push. */
export function setOnChangeEnqueued(cb: (() => void) | null) {
  onEnqueued = cb;
}

/**
 * Record that a row changed and must be pushed. Deletes are soft (deleted_at set
 * on the row), so every queue entry is an upsert of the row's current state.
 */
export function enqueueChange(table: SyncTable, rowId: string) {
  getDb().runSync('INSERT INTO sync_queue (table_name, row_id, queued_at) VALUES (?, ?, ?)', [
    table,
    rowId,
    nowIso(),
  ]);
  onEnqueued?.();
}

export type QueueEntry = { id: number; table_name: SyncTable; row_id: string };

export function readQueue(): QueueEntry[] {
  return getDb().getAllSync<QueueEntry>('SELECT id, table_name, row_id FROM sync_queue ORDER BY id ASC');
}

export function clearQueueEntries(maxIdInclusive: number, table: SyncTable, rowId: string) {
  getDb().runSync('DELETE FROM sync_queue WHERE id <= ? AND table_name = ? AND row_id = ?', [
    maxIdInclusive,
    table,
    rowId,
  ]);
}

export function pendingCount(): number {
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(DISTINCT table_name || ":" || row_id) AS n FROM sync_queue',
  );
  return row?.n ?? 0;
}

export function getSyncState(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [key]);
  return row?.value ?? null;
}

/**
 * Insert a sync_state row only if the key is new. Returns true iff this
 * caller created it — used to claim one-shot work like first-sync backfill.
 */
export function claimSyncState(key: string, value: string): boolean {
  const result = getDb().runSync('INSERT OR IGNORE INTO sync_state (key, value) VALUES (?, ?)', [
    key,
    value,
  ]);
  return result.changes > 0;
}

export function setSyncState(key: string, value: string) {
  getDb().runSync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
