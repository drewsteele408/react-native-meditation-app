import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { listFavoriteSessions } from '../repositories/supabaseRepository';
import type { AsyncStatus, MeditationSession } from '../types';

interface LibraryStore {
  favorites: MeditationSession[];
  status: AsyncStatus;
  error: string | null;
  loadFavorites: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>()(
  immer((set, get) => ({
    favorites: [],
    status: 'idle',
    error: null,

    loadFavorites: async () => {
      // Re-entrancy guard: useFocusEffect can fire loadFavorites() again
      // before a prior call has resolved — ignore the overlap rather than
      // risk an out-of-order response overwriting a newer one.
      if (get().status === 'loading') return;

      set((state) => {
        state.status = 'loading';
        state.error = null;
      });
      try {
        const favorites = await listFavoriteSessions();
        set((state) => {
          state.favorites = favorites;
          state.status = 'success';
        });
      } catch (err) {
        set((state) => {
          state.status = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to load saved meditations.';
        });
      }
    },
  }))
);
