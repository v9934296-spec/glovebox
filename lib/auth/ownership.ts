/**
 * Pure account-binding and access rules. No React Native, SQLite, or Supabase
 * imports — unit-tested in isolation.
 *
 * Invariant: a SQLite cache belonging to user A must never be shown to,
 * backfilled into, or synced as user B.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'localOnly';

export type OwnershipAction = 'continue' | 'bind' | 'reset-and-bind';

/**
 * Main tabs are reachable only with an authenticated Supabase session.
 * `localOnly` is leftover internal state and must not grant access.
 */
export function canAccessApp(status: AuthStatus): boolean {
  return status === 'signedIn';
}

/**
 * Backfill/push/pull may run only when the local database is already bound
 * to the authenticated user.
 */
export function canSyncAsUser(boundUserId: string | null, currentUserId: string | null): boolean {
  return currentUserId != null && boundUserId === currentUserId;
}

/**
 * Decide what to do with the on-device cache when an authenticated user
 * becomes current.
 *
 * - same owner → keep local rows and start sync
 * - no owner, empty cache → bind (pre-release; no anonymous users to adopt)
 * - no owner, existing rows → reset then bind (do not upload unowned/dev rows)
 * - different owner → reset then bind (never show or upload A as B)
 */
export function decideDatabaseOwnership(input: {
  boundUserId: string | null;
  currentUserId: string;
  hasLocalRows: boolean;
}): OwnershipAction {
  if (input.boundUserId === input.currentUserId) return 'continue';
  if (input.boundUserId == null || input.boundUserId === '') {
    return input.hasLocalRows ? 'reset-and-bind' : 'bind';
  }
  return 'reset-and-bind';
}
