import {
  canAccessApp,
  canSyncAsUser,
  decideDatabaseOwnership,
} from '../ownership';

describe('canAccessApp', () => {
  it('allows only an authenticated signed-in session', () => {
    expect(canAccessApp('signedIn')).toBe(true);
  });

  it('blocks signed-out, loading, and leftover local-only state', () => {
    expect(canAccessApp('signedOut')).toBe(false);
    expect(canAccessApp('loading')).toBe(false);
    expect(canAccessApp('localOnly')).toBe(false);
  });
});

describe('canSyncAsUser', () => {
  it('allows backfill/sync only when the database is bound to the current user', () => {
    expect(canSyncAsUser('user-a', 'user-a')).toBe(true);
  });

  it('blocks backfill when the owner has not been validated', () => {
    expect(canSyncAsUser(null, 'user-a')).toBe(false);
    expect(canSyncAsUser(null, null)).toBe(false);
  });

  it('blocks backfill when the bound owner is a different user', () => {
    expect(canSyncAsUser('user-a', 'user-b')).toBe(false);
    expect(canSyncAsUser('user-a', null)).toBe(false);
  });
});

describe('decideDatabaseOwnership', () => {
  it('same-user re-login preserves the local database', () => {
    expect(
      decideDatabaseOwnership({
        boundUserId: 'user-a',
        currentUserId: 'user-a',
        hasLocalRows: true,
      }),
    ).toBe('continue');
  });

  it('first authenticated user on an empty unbound database binds without reset', () => {
    expect(
      decideDatabaseOwnership({
        boundUserId: null,
        currentUserId: 'user-a',
        hasLocalRows: false,
      }),
    ).toBe('bind');
  });

  it('does not silently assign unowned historical/dev rows to the new account', () => {
    expect(
      decideDatabaseOwnership({
        boundUserId: null,
        currentUserId: 'user-a',
        hasLocalRows: true,
      }),
    ).toBe('reset-and-bind');
  });

  it('different-user login resets previous local data and rebinds', () => {
    expect(
      decideDatabaseOwnership({
        boundUserId: 'user-a',
        currentUserId: 'user-b',
        hasLocalRows: true,
      }),
    ).toBe('reset-and-bind');
  });

  it('different-user login on an empty cache still rebinds (never keep A as B)', () => {
    expect(
      decideDatabaseOwnership({
        boundUserId: 'user-a',
        currentUserId: 'user-b',
        hasLocalRows: false,
      }),
    ).toBe('reset-and-bind');
  });
});
