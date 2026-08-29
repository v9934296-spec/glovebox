jest.mock('../../db/database', () => ({
  getDb: () => ({ runSync: mockRunSync }),
  nowIso: () => '2026-01-01T00:00:00.000Z',
}));

const mockRunSync = jest.fn();

import { claimSyncState } from '../queue';

describe('claimSyncState', () => {
  beforeEach(() => {
    mockRunSync.mockReset();
  });

  it('returns true when INSERT OR IGNORE created the row', () => {
    mockRunSync.mockReturnValue({ changes: 1, lastInsertRowId: 1 });
    expect(claimSyncState('backfilled:u1', '1')).toBe(true);
    expect(mockRunSync).toHaveBeenCalledWith(
      'INSERT OR IGNORE INTO sync_state (key, value) VALUES (?, ?)',
      ['backfilled:u1', '1'],
    );
  });

  it('returns false when the key already exists', () => {
    mockRunSync.mockReturnValue({ changes: 0, lastInsertRowId: 0 });
    expect(claimSyncState('backfilled:u1', '1')).toBe(false);
  });
});
