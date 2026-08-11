import { coalesceQueue, cursorAfter, INITIAL_CURSOR, laterTimestamp, localUpsertSql, parseCursor, shouldApplyRemote } from '../merge';
import type { QueueEntry } from '../queue';

describe('coalesceQueue', () => {
  it('returns empty for empty queue', () => { expect(coalesceQueue([])).toEqual([]); });
  it('collapses repeated writes to the same row, keeping the max queue id', () => {
    const entries: QueueEntry[] = [
      { id: 1, table_name: 'vehicles', row_id: 'v1' }, { id: 2, table_name: 'service_records', row_id: 's1' },
      { id: 3, table_name: 'vehicles', row_id: 'v1' }, { id: 4, table_name: 'vehicles', row_id: 'v2' },
    ];
    expect(coalesceQueue(entries)).toEqual([
      { table: 'vehicles', rowId: 'v1', maxQueueId: 3 },
      { table: 'service_records', rowId: 's1', maxQueueId: 2 },
      { table: 'vehicles', rowId: 'v2', maxQueueId: 4 },
    ]);
  });
  it('preserves first-seen order (parents before children)', () => {
    const entries: QueueEntry[] = [
      { id: 1, table_name: 'vehicles', row_id: 'v1' }, { id: 2, table_name: 'reminders', row_id: 'r1' }, { id: 3, table_name: 'vehicles', row_id: 'v1' },
    ];
    const result = coalesceQueue(entries); expect(result[0]?.table).toBe('vehicles'); expect(result[1]?.table).toBe('reminders');
  });
});

describe('shouldApplyRemote', () => {
  const LOCAL = '2026-07-01T12:00:00.000Z'; const OLDER = '2026-07-01T11:00:00+00:00'; const NEWER = '2026-07-01T13:00:00+00:00'; const SAME = '2026-07-01T12:00:00+00:00';
  it('applies when there is no local row', () => { expect(shouldApplyRemote({ localUpdatedAt: null, remoteUpdatedAt: NEWER, hasPendingLocalChange: false })).toBe(true); });
  it('applies newer remote over clean local', () => { expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: NEWER, hasPendingLocalChange: false })).toBe(true); });
  it('skips older remote over clean local', () => { expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: OLDER, hasPendingLocalChange: false })).toBe(false); });
  it('compares across Z and +00:00 timestamp formats (equal applies when clean)', () => { expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: SAME, hasPendingLocalChange: false })).toBe(true); });
  it('keeps pending local edit when remote is not strictly newer', () => {
    expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: SAME, hasPendingLocalChange: true })).toBe(false);
    expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: OLDER, hasPendingLocalChange: true })).toBe(false);
  });
  it('lets a strictly newer remote beat a pending local edit', () => { expect(shouldApplyRemote({ localUpdatedAt: LOCAL, remoteUpdatedAt: NEWER, hasPendingLocalChange: true })).toBe(true); });
});

describe('laterTimestamp', () => {
  it('takes the later of two timestamps across formats', () => {
    expect(laterTimestamp('2026-07-01T12:00:00.000Z', '2026-07-01T13:00:00+00:00')).toBe('2026-07-01T13:00:00+00:00');
    expect(laterTimestamp('2026-07-01T14:00:00.000Z', '2026-07-01T13:00:00+00:00')).toBe('2026-07-01T14:00:00.000Z');
    expect(laterTimestamp(null, '2026-07-01T13:00:00+00:00')).toBe('2026-07-01T13:00:00+00:00');
  });
});

describe('stable sync cursor', () => {
  it('advances by id when timestamps tie', () => {
    const a = cursorAfter(INITIAL_CURSOR, { updated_at: '2026-08-11T10:00:00Z', id: 'a' });
    expect(cursorAfter(a, { updated_at: '2026-08-11T10:00:00Z', id: 'b' })).toEqual({ updatedAt: '2026-08-11T10:00:00Z', id: 'b' });
  });
  it('round trips persisted cursor JSON', () => { const cursor = { updatedAt: '2026-08-11T10:00:00Z', id: 'z' }; expect(parseCursor(JSON.stringify(cursor))).toEqual(cursor); });
});

describe('local sync upsert', () => {
  it('uses ON CONFLICT and never SQLite REPLACE semantics', () => { const sql = localUpsertSql('vehicles', ['id', 'workspace_id', 'nickname']); expect(sql).toContain('ON CONFLICT(id) DO UPDATE'); expect(sql).not.toContain('REPLACE'); });
});
