import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { generateScript } from '../repositories/geminiRepository';
import { synthesizeSpeech } from '../repositories/elevenLabsRepository';
import { getSession, refreshAudioUrl, setFavorite } from '../repositories/supabaseRepository';
import type { AsyncStatus } from '../types';

interface MeditationStore {
  prompt: string;
  sessionId: string | null;
  script: string | null;
  scriptStatus: AsyncStatus;
  audioUrl: string | null;
  audioStatus: AsyncStatus;
  isFavorite: boolean;
  favoriteStatus: AsyncStatus;
  error: string | null;
  setPrompt: (prompt: string) => void;
  generate: (prompt: string, durationMinutes?: number) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  toggleFavorite: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  prompt: '',
  sessionId: null,
  script: null,
  scriptStatus: 'idle' as AsyncStatus,
  audioUrl: null,
  audioStatus: 'idle' as AsyncStatus,
  isFavorite: false,
  favoriteStatus: 'idle' as AsyncStatus,
  error: null,
};

export const useMeditationStore = create<MeditationStore>()(
  immer((set, get) => ({
    ...initialState,

    setPrompt: (prompt) =>
      set((state) => {
        state.prompt = prompt;
      }),

    generate: async (prompt, durationMinutes) => {
      // Re-entrancy guard: ignore double-taps on Generate while a run is in flight
      if (get().scriptStatus === 'loading' || get().audioStatus === 'loading') return;

      set((state) => {
        state.scriptStatus = 'loading';
        state.audioStatus = 'idle';
        state.isFavorite = false;
        state.favoriteStatus = 'idle';
        state.error = null;
      });

      let sessionId: string;
      try {
        const result = await generateScript(prompt, durationMinutes);
        sessionId = result.sessionId;
        set((state) => {
          state.sessionId = result.sessionId;
          state.script = result.script;
          state.scriptStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.scriptStatus = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to generate script.';
        });
        return;
      }

      set((state) => {
        state.audioStatus = 'loading';
      });
      try {
        const url = await synthesizeSpeech(sessionId);
        set((state) => {
          state.audioUrl = url;
          state.audioStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.audioStatus = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to generate audio.';
        });
      }
    },

    loadSession: async (sessionId) => {
      // Re-entrancy guard mirrors generate() — ignore if a run is already in flight.
      if (get().scriptStatus === 'loading' || get().audioStatus === 'loading') return;

      set((state) => {
        state.scriptStatus = 'loading';
        state.audioStatus = 'idle';
        state.favoriteStatus = 'idle';
        state.error = null;
      });

      try {
        const session = await getSession(sessionId);
        set((state) => {
          state.sessionId = session.id;
          state.script = session.script;
          state.isFavorite = session.is_favorite;
          state.scriptStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.sessionId = null;
          state.script = null;
          state.isFavorite = false;
          state.audioUrl = null;
          state.scriptStatus = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to load meditation.';
        });
        return;
      }

      set((state) => {
        state.audioStatus = 'loading';
      });
      try {
        const url = await refreshAudioUrl(sessionId);
        set((state) => {
          state.audioUrl = url;
          state.audioStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          state.audioStatus = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to load audio.';
        });
      }
    },

    toggleFavorite: async () => {
      const { sessionId, isFavorite, favoriteStatus } = get();
      if (!sessionId || favoriteStatus === 'loading') return;

      const next = !isFavorite;
      set((state) => {
        state.isFavorite = next;
        state.favoriteStatus = 'loading';
        state.error = null;
      });
      try {
        await setFavorite(sessionId, next);
        set((state) => {
          // The store may have moved on to a different session (e.g. the
          // user navigated away) while this request was in flight — don't
          // let a late resolution touch that other session's state.
          if (state.sessionId !== sessionId) return;
          state.favoriteStatus = 'success';
        });
      } catch (err) {
        set((state) => {
          if (state.sessionId !== sessionId) return;
          state.isFavorite = !next;
          state.favoriteStatus = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to update favorite.';
        });
      }
    },

    reset: () => set(() => ({ ...initialState })),
  }))
);
