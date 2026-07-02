import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { currentUserId } from '../auth/session';
import { bumpDataVersion, getDb, nowIso } from '../db/database';
import { isSupabaseConfigured, getSupabase } from '../supabase';
import { ensureLocalMedia, uploadRowMedia } from './media';
import { coalesceQueue, laterTimestamp, remoteSubResourceIsNewer, shouldApplyRemote } from './merge';
import {
  clearQueueEntries,
  enqueueChange,
  getSyncState,
  pendingCount,
  readQueue,
  setOnChangeEnqueued,
  setSyncState,
  SYNC_TABLES,
  type SyncTable,
} from './queue';

type LocalRow = Record<string, string | number | null>;

/**
 * Per-table sync mapping. `columns` are identical local/cloud; media columns
 * differ (local file URI vs storage path) and are translated during push/pull.
 */
type TableConfig = {
  columns: string[];
  mediaLocalColumn?: string;
  mediaCloudColumn?: string;
  /**
   * Timestamp/data column pairs for independently-fetched snapshots (VIN decode,
   * recall check) that must not regress: on push, whichever side's timestamp is
   * newer wins for that pair, instead of the whole-row upsert blindly overwriting
   * a fresher remote snapshot with a stale local one.
   */
  snapshotPairs?: { timestampColumn: string; dataColumn: string }[];
};

const TABLE_CONFIG: Record<SyncTable, TableConfig> = {
  vehicles: {
    columns: [
      'id', 'nickname', 'make', 'model', 'year', 'trim', 'vin', 'license_plate', 'mileage',
      'purchase_date', 'purchase_price', 'vin_decoded_at', 'vin_decode_json', 'recall_checked_at',
      'recall_json', 'created_at', 'updated_at', 'deleted_at',
    ],
    mediaLocalColumn: 'photo_uri',
    mediaCloudColumn: 'photo_path',
    snapshotPairs: [
      { timestampColumn: 'vin_decoded_at', dataColumn: 'vin_decode_json' },
      { timestampColumn: 'recall_checked_at', dataColumn: 'recall_json' },
    ],
  },
  service_records: {
    columns: [
      'id', 'vehicle_id', 'service_type', 'date', 'mileage', 'cost', 'shop_name', 'notes',
      'next_due_date', 'next_due_mileage', 'created_at', 'updated_at', 'deleted_at',
    ],
    mediaLocalColumn: 'receipt_uri',
    mediaCloudColumn: 'receipt_path',
  },
  reminders: {
    columns: [
      'id', 'vehicle_id', 'title', 'category', 'due_date', 'due_mileage', 'recurrence_type',
      'recurrence_interval_months', 'recurrence_interval_miles', 'status', 'completed_at',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
};

type SyncStatusState = {
  syncing: boolean;
  lastSyncedAt: string | null;
  pending: number;
  error: string | null;
};

export const useSyncStatus = create<SyncStatusState>(() => ({
  syncing: false,
  lastSyncedAt: null,
  pending: 0,
  error: null,
}));

function refreshStatus(partial?: Partial<SyncStatusState>) {
  useSyncStatus.setState({
    pending: pendingCount(),
    lastSyncedAt: getSyncState('lastSyncedAt'),
    ...partial,
  });
}

function getLocalRow(table: SyncTable, rowId: string): LocalRow | null {
  return getDb().getFirstSync<LocalRow>(`SELECT * FROM ${table} WHERE id = ?`, [rowId]);
}

/**
 * First sync for a user: everything already on the device (including rows
 * created before Phase 2 or while signed out) gets queued for push.
 */
function backfillIfNeeded(userId: string) {
  const key = `backfilled:${userId}`;
  if (getSyncState(key) === '1') return;
  for (const table of SYNC_TABLES) {
    const rows = getDb().getAllSync<{ id: string }>(`SELECT id FROM ${table}`);
    for (const row of rows) enqueueChange(table, row.id);
  }
  setSyncState(key, '1');
}

/**
 * Fetches the current remote value of each snapshot pair for the given ids, keyed by id.
 * A push then keeps whichever side (local vs. remote) has the newer snapshot timestamp,
 * instead of always overwriting remote with the pushing device's possibly-stale copy.
 */
async function fetchRemoteSnapshots(
  table: SyncTable,
  config: TableConfig,
  ids: string[],
): Promise<Map<string, LocalRow>> {
  const snapshots = new Map<string, LocalRow>();
  if (!config.snapshotPairs || config.snapshotPairs.length === 0 || ids.length === 0) return snapshots;
  const supabase = getSupabase();
  const selectColumns = ['id', ...config.snapshotPairs.flatMap((p) => [p.timestampColumn, p.dataColumn])];
  const { data, error } = await supabase.from(table).select(selectColumns.join(',')).in('id', ids);
  if (error) throw new Error(`push ${table} snapshot fetch failed: ${error.message}`);
  for (const row of (data ?? []) as unknown as LocalRow[]) {
    snapshots.set(row.id as string, row);
  }
  return snapshots;
}

async function pushQueue(userId: string) {
  const changes = coalesceQueue(readQueue());
  if (changes.length === 0) return;
  const supabase = getSupabase();
  let firstError: Error | null = null;

  // Table order keeps vehicles ahead of their children. A failure on one table
  // (e.g. a not-yet-applied migration) shouldn't stop the others from pushing,
  // or the caller from still pulling — so failures are collected, not thrown,
  // until every table has been attempted.
  for (const table of SYNC_TABLES) {
    const tableChanges = changes.filter((c) => c.table === table);
    if (tableChanges.length === 0) continue;
    const config = TABLE_CONFIG[table];

    try {
      const remoteSnapshots = await fetchRemoteSnapshots(table, config, tableChanges.map((c) => c.rowId));
      const payloads: Record<string, unknown>[] = [];

      for (const change of tableChanges) {
        const row = getLocalRow(table, change.rowId);
        if (!row) continue; // row hard-deleted locally (data reset); nothing to push
        const payload: Record<string, unknown> = { user_id: userId };
        for (const col of config.columns) payload[col] = row[col] ?? null;
        if (config.mediaLocalColumn && config.mediaCloudColumn) {
          const localUri = (row[config.mediaLocalColumn] as string | null) ?? null;
          payload[config.mediaCloudColumn] =
            row.deleted_at === null ? await uploadRowMedia(userId, table, change.rowId, localUri) : null;
        }
        const remote = remoteSnapshots.get(change.rowId);
        if (remote) {
          for (const pair of config.snapshotPairs ?? []) {
            const localTs = (row[pair.timestampColumn] as string | null) ?? null;
            const remoteTs = (remote[pair.timestampColumn] as string | null) ?? null;
            if (remoteSubResourceIsNewer(localTs, remoteTs)) {
              payload[pair.timestampColumn] = remoteTs;
              payload[pair.dataColumn] = remote[pair.dataColumn] ?? null;
            }
          }
        }
        payloads.push(payload);
      }

      if (payloads.length > 0) {
        const { error } = await supabase.from(table).upsert(payloads);
        if (error) throw new Error(`push ${table} failed: ${error.message}`);
      }
      for (const change of tableChanges) {
        clearQueueEntries(change.maxQueueId, table, change.rowId);
      }
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(`push ${table} failed`);
    }
  }

  if (firstError) throw firstError;
}

async function pullChanges(userId: string) {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  let applied = 0;

  for (const table of SYNC_TABLES) {
    const config = TABLE_CONFIG[table];
    const cursorKey = `cursor:${userId}:${table}`;
    let cursor = getSyncState(cursorKey) ?? '1970-01-01T00:00:00Z';

    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(PAGE_SIZE);
      if (error) throw new Error(`pull ${table} failed: ${error.message}`);
      const rows = (data ?? []) as LocalRow[];
      if (rows.length === 0) break;

      const pendingIds = new Set(
        readQueue()
          .filter((e) => e.table_name === table)
          .map((e) => e.row_id),
      );

      for (const remote of rows) {
        const id = remote.id as string;
        const local = getLocalRow(table, id);
        const apply = shouldApplyRemote({
          localUpdatedAt: (local?.updated_at as string | null) ?? null,
          remoteUpdatedAt: remote.updated_at as string,
          hasPendingLocalChange: pendingIds.has(id),
        });
        cursor = laterTimestamp(cursor, remote.updated_at as string);
        if (!apply) continue;

        const values: LocalRow = {};
        for (const col of TABLE_CONFIG[table].columns) {
          values[col] = (remote[col] as string | number | null) ?? null;
        }
        if (config.mediaLocalColumn && config.mediaCloudColumn) {
          const remotePath = (remote[config.mediaCloudColumn] as string | null) ?? null;
          const existingLocal = (local?.[config.mediaLocalColumn] as string | null) ?? null;
          values[config.mediaLocalColumn] =
            remote.deleted_at === null ? await ensureLocalMedia(remotePath, existingLocal) : existingLocal;
        }

        const cols = Object.keys(values);
        getDb().runSync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => values[c] ?? null),
        );
        applied += 1;
      }

      setSyncState(cursorKey, cursor);
      if (rows.length < PAGE_SIZE) break;
    }
  }

  if (applied > 0) bumpDataVersion();
}

let syncing = false;
let syncAgainRequested = false;

/** Full sync pass: backfill (first run per user) → push queue → pull changes. */
export async function syncNow(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = currentUserId();
  if (!userId) return;
  if (syncing) {
    syncAgainRequested = true;
    return;
  }
  syncing = true;
  useSyncStatus.setState({ syncing: true, error: null });
  try {
    const network = await Network.getNetworkStateAsync();
    if (network.isConnected === false) return;
    backfillIfNeeded(userId);
    // A push failure (e.g. a cloud migration that hasn't been applied yet) is kept
    // aside rather than thrown immediately, so pulling other devices' changes still
    // runs instead of stalling entirely on one table's error.
    let pushError: Error | null = null;
    try {
      await pushQueue(userId);
    } catch (e) {
      pushError = e instanceof Error ? e : new Error('Push failed');
    }
    await pullChanges(userId);
    if (pushError) throw pushError;
    setSyncState('lastSyncedAt', nowIso());
  } catch (e) {
    useSyncStatus.setState({ error: e instanceof Error ? e.message : 'Sync failed' });
  } finally {
    syncing = false;
    refreshStatus({ syncing: false });
    if (syncAgainRequested) {
      syncAgainRequested = false;
      void syncNow();
    }
  }
}

const DEBOUNCE_MS = 3000;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  refreshStatus();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

/**
 * Wire sync triggers while a user is signed in: initial sync, debounced sync
 * after every local write, and a sync when the app returns to foreground.
 * Returns a cleanup function for effect usage.
 */
export function startSyncLifecycle(): () => void {
  setOnChangeEnqueued(scheduleSync);
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncNow();
  });
  refreshStatus();
  void syncNow();
  return () => {
    setOnChangeEnqueued(null);
    subscription.remove();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
