import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthStore {
  user: User | null;
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  immer((set) => ({
    user: null,
    session: null,
    status: 'loading',
    error: null,

    setSession: (session) =>
      set((state) => {
        state.session = session;
        state.user = session?.user ?? null;
        state.status = session ? 'authenticated' : 'unauthenticated';
        state.error = null;
      }),

    signIn: async (email, password) => {
      set((state) => {
        state.status = 'loading';
        state.error = null;
      });
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          set((state) => {
            state.status = 'unauthenticated';
            state.error = error.message;
          });
        }
      } catch (err) {
        set((state) => {
          state.status = 'unauthenticated';
          state.error = err instanceof Error ? err.message : 'Failed to sign in.';
        });
      }
    },

    signUp: async (email, password, displayName) => {
      set((state) => {
        state.status = 'loading';
        state.error = null;
      });
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) {
          set((state) => {
            state.status = 'unauthenticated';
            state.error = error.message;
          });
        }
      } catch (err) {
        set((state) => {
          state.status = 'unauthenticated';
          state.error = err instanceof Error ? err.message : 'Failed to create account.';
        });
      }
    },

    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          set((state) => {
            state.error = error.message;
          });
        }
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to sign out.';
        });
      }
    },
  }))
);
