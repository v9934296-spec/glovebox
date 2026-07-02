import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { getSupabase, isSupabaseConfigured } from '../supabase';

const LOCAL_ONLY_KEY = 'glovebox.localOnly';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'localOnly';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueWithoutAccount: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'localOnly', session: null });
      return;
    }
    const supabase = getSupabase();
    const [{ data }, localOnly] = await Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem(LOCAL_ONLY_KEY),
    ]);
    if (data.session) {
      set({ status: 'signedIn', session: data.session });
    } else {
      set({ status: localOnly === '1' ? 'localOnly' : 'signedOut', session: null });
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        set({ status: 'signedIn', session });
      } else if (get().status === 'signedIn') {
        // Session ended (sign-out or expiry); fall back to the local-only choice if made.
        void AsyncStorage.getItem(LOCAL_ONLY_KEY).then((flag) => {
          set({ status: flag === '1' ? 'localOnly' : 'signedOut', session: null });
        });
      }
    });
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
    set({ status: 'signedOut', session: null });
    await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
  },

  continueWithoutAccount: async () => {
    await AsyncStorage.setItem(LOCAL_ONLY_KEY, '1');
    set({ status: 'localOnly' });
  },
}));

/** Current user id, or null in local-only mode. */
export function currentUserId(): string | null {
  return useAuth.getState().session?.user.id ?? null;
}
