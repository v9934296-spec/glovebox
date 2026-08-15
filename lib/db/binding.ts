import AsyncStorage from '@react-native-async-storage/async-storage';
import { decideDatabaseOwnership } from '../auth/ownership';
import { getDb, resetAllData } from './database';

export const BOUND_USER_KEY = 'glovebox.boundUserId';

let boundUserIdCache: string | null | undefined;

export async function loadBoundUserId(): Promise<string | null> {
  if (boundUserIdCache !== undefined) return boundUserIdCache;
  const value = await AsyncStorage.getItem(BOUND_USER_KEY);
  boundUserIdCache = value;
  return value;
}

export function peekBoundUserId(): string | null {
  return boundUserIdCache ?? null;
}

export async function setBoundUserId(userId: string): Promise<void> {
  boundUserIdCache = userId;
  await AsyncStorage.setItem(BOUND_USER_KEY, userId);
}

export async function clearBoundUserId(): Promise<void> {
  boundUserIdCache = null;
  await AsyncStorage.removeItem(BOUND_USER_KEY);
}

function hasLocalApplicationData(): boolean {
  const database = getDb();
  for (const table of ['vehicles', 'service_records', 'reminders', 'sync_queue'] as const) {
    const row = database.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    if ((row?.n ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Apply the ownership decision before the signed-in UI or sync may run.
 * Safe to call repeatedly for the same user (no-op after the first bind).
 */
export async function ensureDatabaseOwnership(userId: string): Promise<void> {
  const boundUserId = await loadBoundUserId();
  const action = decideDatabaseOwnership({
    boundUserId,
    currentUserId: userId,
    hasLocalRows: hasLocalApplicationData(),
  });
  if (action === 'continue') return;
  if (action === 'reset-and-bind') {
    resetAllData();
  }
  await setBoundUserId(userId);
}
