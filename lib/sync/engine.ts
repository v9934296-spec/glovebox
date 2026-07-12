import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { currentUserId } from '../auth/session';
import { bumpDataVersion, claimLocalDataForUser, getDb, nowIso } from '../db/database';
import { isSupabaseConfigured, getSupabase } from '../supabase';
import { ensureLocalMedia, uploadRowMedia } from './media';
import { parsePullCursor, postgrestLiteral, serializePullCursor } from './cursor';
import { coalesceQueue, shouldApplyRemote } from './merge';
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

function applyRemoteRow(table: SyncTable, values: LocalRow) {
  const cols = Object.keys(values);
  const updateCols = cols.filter((col) => col !== 'id');
  const assignments = updateCols.map((col) => `${col} = excluded.${col}`).join(', ');
  getDb().runSync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${assignments}`,
    cols.map((col) => values[col] ?? null),
  );
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

async function pushQueue(userId: string) {
  const changes = coalesceQueue(readQueue());
  if (changes.length === 0) return;
  const supabase = getSupabase();

  // Table order keeps vehicles ahead of their children.
  for (const table of SYNC_TABLES) {
    const tableChanges = changes.filter((c) => c.table === table);
    if (tableChanges.length === 0) continue;
    const config = TABLE_CONFIG[table];
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
      payloads.push(payload);
    }

    if (payloads.length > 0) {
      const sentUpdatedAt = new Map(
        payloads.map((payload) => [String(payload.id), String(payload.updated_at)]),
      );
      const { data, error } = await supabase.from(table).upsert(payloads).select('id, updated_at');
      if (error) throw new Error(`push ${table} failed: ${error.message}`);

      // The database owns authoritative modification time. Only acknowledge the
      // exact local version we sent so an edit made during the request is never
      // overwritten by an older acknowledgement.
      for (const ack of (data ?? []) as Array<{ id: string; updated_at: string }>) {
        const sent = sentUpdatedAt.get(ack.id);
        if (!sent) continue;
        getDb().runSync(`UPDATE ${table} SET updated_at = ? WHERE id = ? AND updated_at = ?`, [
          ack.updated_at,
          ack.id,
          sent,
        ]);
      }
    }
    for (const change of tableChanges) {
      clearQueueEntries(change.maxQueueId, table, change.rowId);
    }
  }
}

async function pullChanges(userId: string) {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  let applied = 0;

  for (const table of SYNC_TABLES) {
    const config = TABLE_CONFIG[table];
    // v2 intentionally replays from epoch once, repairing rows that the old
    // timestamp-only cursor could have skipped when timestamps were identical.
    const cursorKey = `cursor:v2:${userId}:${table}`;
    let cursor = parsePullCursor(getSyncState(cursorKey));

    for (;;) {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PAGE_SIZE);

      query = cursor.id
        ? query.or(
            `updated_at.gt.${postgrestLiteral(cursor.updatedAt)},` +
              `and(updated_at.eq.${postgrestLiteral(cursor.updatedAt)},id.gt.${postgrestLiteral(cursor.id)})`,
          )
        : query.gt('updated_at', cursor.updatedAt);

      const { data, error } = await query;
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
        const remoteUpdatedAt = remote.updated_at as string;
        const local = getLocalRow(table, id);
        const apply = shouldApplyRemote({
          localUpdatedAt: (local?.updated_at as string | null) ?? null,
          remoteUpdatedAt,
          hasPendingLocalChange: pendingIds.has(id),
        });

        cursor = { updatedAt: remoteUpdatedAt, id };
        if (!apply) continue;

        const values: LocalRow = {};
        for (const col of config.columns) {
          values[col] = (remote[col] as string | number | null) ?? null;
        }
        if (config.mediaLocalColumn && config.mediaCloudColumn) {
          const remotePath = (remote[config.mediaCloudColumn] as string | null) ?? null;
          const existingLocal = (local?.[config.mediaLocalColumn] as string | null) ?? null;
          values[config.mediaLocalColumn] =
            remote.deleted_at === null ? await ensureLocalMedia(remotePath, existingLocal) : existingLocal;
        }

        applyRemoteRow(table, values);
        applied += 1;
      }

      setSyncState(cursorKey, serializePullCursor(cursor));
      if (rows.length < PAGE_SIZE) break;
    }
  }

  if (applied > 0) bumpDataVersion();
}

let syncing = false;
let syncAgainRequested = false;

/** Full sync pass: account guard → backfill → push queue → pull changes. */
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
    claimLocalDataForUser(userId);
    const network = await Network.getNetworkStateAsync();
    if (network.isConnected === false) return;
    backfillIfNeeded(userId);
    await pushQueue(userId);
    await pullChanges(userId);
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
