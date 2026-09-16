import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { generateScript } from '../repositories/geminiRepository';
import { synthesizeSpeech } from '../repositories/elevenLabsRepository';
import type { AsyncStatus } from '../types';

interface MeditationStore {
  prompt: string;
  sessionId: string | null;
  script: string | null;
  scriptStatus: AsyncStatus;
  audioUrl: string | null;
  audioStatus: AsyncStatus;
  error: string | null;
  setPrompt: (prompt: string) => void;
  generate: (prompt: string, durationMinutes?: number) => Promise<void>;
  reset: () => void;
}

const initialState = {
  prompt: '',
  sessionId: null,
  script: null,
  scriptStatus: 'idle' as AsyncStatus,
  audioUrl: null,
  audioStatus: 'idle' as AsyncStatus,
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

    reset: () => set(() => ({ ...initialState })),
  }))
);
