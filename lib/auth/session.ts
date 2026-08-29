import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError, type Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { clearBoundUserId, ensureDatabaseOwnership } from '../db/binding';
import { resetAllData } from '../db/database';
import { identifyPurchasesUser } from '../monetization/purchases';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import { runPostDeletionTeardown } from './deletion';
import { applyIfEpochMatches } from './epoch';
import type { AuthStatus } from './ownership';

const LOCAL_ONLY_KEY = 'glovebox.localOnly';

export type { AuthStatus };

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueWithoutAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

let authEpoch = 0;
let authListener: { unsubscribe: () => void } | null = null;

type AuthSnapshot = Pick<AuthState, 'status' | 'session'>;

/**
 * Commit auth status only if `epoch` is still the live counter. The compare
 * happens inside Zustand's updater so it cannot interleave with sign-out.
 */
function setIfCurrentEpoch(
  set: (updater: (state: AuthState) => AuthState) => void,
  epoch: number,
  next: AuthSnapshot,
): void {
  set((state) => applyIfEpochMatches(epoch, authEpoch, state, { ...state, ...next }));
}

async function enterSignedIn(
  session: Session,
  set: (updater: (state: AuthState) => AuthState) => void,
  epoch: number,
): Promise<void> {
  await ensureDatabaseOwnership(session.user.id);
  setIfCurrentEpoch(set, epoch, { status: 'signedIn', session });
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'signedOut', session: null });
      return;
    }
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const epoch = ++authEpoch;
      try {
        await enterSignedIn(data.session, set, epoch);
      } catch {
        setIfCurrentEpoch(set, epoch, { status: 'signedOut', session: null });
      }
    } else {
      set({ status: 'signedOut', session: null });
    }
    authListener?.unsubscribe();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const epoch = ++authEpoch;
        void enterSignedIn(session, set, epoch).catch(() => {
          setIfCurrentEpoch(set, epoch, { status: 'signedOut', session: null });
        });
      } else {
        authEpoch += 1;
        if (get().status !== 'localOnly') {
          set({ status: 'signedOut', session: null });
        }
      }
    });
    authListener = listener.subscription;
  },

  signIn: async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  signUp: async (email, password) => {
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsEmailConfirmation: data.session === null };
  },

  sendPasswordReset: async (email) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },

  signOut: async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(error.message);
    authEpoch += 1;
    set({ status: 'signedOut', session: null });
    await identifyPurchasesUser(null);
    const signedInAgain = get().session?.user.id;
    if (signedInAgain) {
      await identifyPurchasesUser(signedInAgain);
      return;
    }
    await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
  },

  continueWithoutAccount: async () => {
    authEpoch += 1;
    await AsyncStorage.setItem(LOCAL_ONLY_KEY, '1');
    set({ status: 'localOnly' });
  },

  deleteAccount: async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Cloud account features are not available in this build.');
    }
    const { error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const detail = await error.context
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => undefined);
        throw new Error(detail ?? 'Could not delete account. Try again later.');
      }
      throw new Error('Could not delete account. Check your connection and try again.');
    }

    // Do not cancel the store subscription — Apple requires users to manage that themselves.
    // Clear the session first so a later local-wipe failure cannot leave this JWT active.
    authEpoch += 1;
    await runPostDeletionTeardown({
      clearSession: async () => {
        try {
          await getSupabase().auth.signOut({ scope: 'local' });
        } finally {
          set({ status: 'signedOut', session: null });
        }
      },
      cleanupLocal: async () => {
        await identifyPurchasesUser(null);
        await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
        resetAllData();
        await clearBoundUserId();
      },
    });
  },
}));

/** Current user id, or null when signed out. */
export function currentUserId(): string | null {
  return useAuth.getState().session?.user.id ?? null;
}
