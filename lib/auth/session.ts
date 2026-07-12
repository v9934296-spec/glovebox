import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { assertLocalOnlyAccess, claimLocalDataForUser } from '../db/database';
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
  handleAuthUrl: (url: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueWithoutAccount: () => Promise<void>;
};

function claimSession(session: Session) {
  claimLocalDataForUser(session.user.id);
}

async function rejectMismatchedSession(message: string): Promise<never> {
  await getSupabase().auth.signOut();
  throw new Error(message);
}

function authParams(url: string): URLSearchParams {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash?.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

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
      try {
        claimSession(data.session);
        set({ status: 'signedIn', session: data.session });
      } catch {
        await supabase.auth.signOut();
        set({ status: localOnly === '1' ? 'localOnly' : 'signedOut', session: null });
        return;
      }
    } else {
      set({ status: localOnly === '1' ? 'localOnly' : 'signedOut', session: null });
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        try {
          claimSession(session);
          set({ status: 'signedIn', session });
        } catch {
          set({ status: 'signedOut', session: null });
          void supabase.auth.signOut();
        }
      } else if (get().status === 'signedIn') {
        // Session ended (sign-out or expiry); fall back to the local-only choice if made.
        void AsyncStorage.getItem(LOCAL_ONLY_KEY).then((flag) => {
          set({ status: flag === '1' ? 'localOnly' : 'signedOut', session: null });
        });
      }
    });
  },

  signIn: async (email, password) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Sign in did not return a session');
    try {
      claimSession(data.session);
    } catch (e) {
      await rejectMismatchedSession(e instanceof Error ? e.message : 'This device belongs to another account');
    }
    await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
    set({ status: 'signedIn', session: data.session });
  },

  signUp: async (email, password) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (data.session) {
      try {
        claimSession(data.session);
      } catch (e) {
        await rejectMismatchedSession(e instanceof Error ? e.message : 'This device belongs to another account');
      }
      await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
      set({ status: 'signedIn', session: data.session });
    }
    return { needsEmailConfirmation: data.session === null };
  },

  sendPasswordReset: async (email) => {
    const redirectTo = Linking.createURL('/reset-password');
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
  },

  handleAuthUrl: async (url) => {
    if (!isSupabaseConfigured) return;
    const params = authParams(url);
    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const supabase = getSupabase();

    let session: Session | null = null;
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error(error.message);
      session = data.session;
    } else if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw new Error(error.message);
      session = data.session;
    }

    if (!session) return;
    try {
      claimSession(session);
    } catch (e) {
      await rejectMismatchedSession(e instanceof Error ? e.message : 'This device belongs to another account');
    }
    await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
    set({ status: 'signedIn', session });
  },

  updatePassword: async (password) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  signOut: async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(error.message);
    set({ status: 'signedOut', session: null });
    await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
  },

  continueWithoutAccount: async () => {
    assertLocalOnlyAccess();
    await AsyncStorage.setItem(LOCAL_ONLY_KEY, '1');
    set({ status: 'localOnly', session: null });
  },
}));

/** Current user id, or null in local-only mode. */
export function currentUserId(): string | null {
  return useAuth.getState().session?.user.id ?? null;
}
