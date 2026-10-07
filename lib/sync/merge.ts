/**
 * Pure sync logic — no Supabase or SQLite imports so it stays unit-testable.
 * Conflict policy: last-write-wins on updated_at; server is source of truth
 * after sync, but unpushed local edits that are newer than the server row win.
 */
import type { QueueEntry, SyncTable } from './queue';

export type CoalescedChange = { table: SyncTable; rowId: string; maxQueueId: number };

/**
 * Collapse duplicate queue entries per row (every entry is "push current row
 * state", so only the newest matters). Preserves first-seen order, which keeps
 * parents (vehicles) ahead of children for the same batch.
 */
export function coalesceQueue(entries: QueueEntry[]): CoalescedChange[] {
  const byKey = new Map<string, CoalescedChange>();
  for (const e of entries) {
    const key = `${e.table_name}:${e.row_id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.maxQueueId = Math.max(existing.maxQueueId, e.id);
    } else {
      byKey.set(key, { table: e.table_name, rowId: e.row_id, maxQueueId: e.id });
    }
  }
  return [...byKey.values()];
}

/**
 * Decide whether a pulled remote row should overwrite the local row.
 * Timestamps are compared via Date.parse because SQLite stores
 * "...Z" ISO strings while Postgres returns "+00:00" offsets.
 */
export function shouldApplyRemote(args: {
  localUpdatedAt: string | null;
  remoteUpdatedAt: string;
  hasPendingLocalChange: boolean;
}): boolean {
  if (args.localUpdatedAt === null) return true;
  const local = Date.parse(args.localUpdatedAt);
  const remote = Date.parse(args.remoteUpdatedAt);
  if (Number.isNaN(local)) return true;
  if (Number.isNaN(remote)) return false;
  if (args.hasPendingLocalChange) {
    // Keep the local edit unless the server row is strictly newer.
    return remote > local;
  }
  return remote >= local;
}

/** Max of two ISO timestamps (used to advance the pull cursor). */
export function laterTimestamp(a: string | null, b: string): string {
  if (a === null) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
}
