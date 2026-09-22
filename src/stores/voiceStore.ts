import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { listVoices } from '../repositories/voicesRepository';
import { getPreferredVoiceId, setPreferredVoiceId } from '../repositories/supabaseRepository';
import type { AsyncStatus, Voice } from '../types';

interface VoiceStore {
  voices: Voice[];
  status: AsyncStatus;
  error: string | null;
  selectedVoiceId: string | null;
  selectVoiceStatus: AsyncStatus;
  loadVoices: (userId: string) => Promise<void>;
  selectVoice: (userId: string, voiceId: string) => void;
}

export const useVoiceStore = create<VoiceStore>()(
  immer((set, get) => ({
    voices: [],
    status: 'idle',
    error: null,
    selectedVoiceId: null,
    selectVoiceStatus: 'idle',

    loadVoices: async (userId) => {
      // Re-entrancy guard mirrors libraryStore.loadFavorites().
      if (get().status === 'loading') return;

      set((state) => {
        state.status = 'loading';
        state.error = null;
      });
      try {
        const [voices, preferredVoiceId] = await Promise.all([
          listVoices(),
          getPreferredVoiceId(userId),
        ]);
        set((state) => {
          state.voices = voices;
          state.status = 'success';
          // Default to the user's remembered pick if it's still an active
          // voice, otherwise the first voice in the catalog — Generate
          // always needs a voiceId to send, even if the user never opens
          // the picker.
          const preferredIsActive =
            preferredVoiceId !== null && voices.some((v) => v.id === preferredVoiceId);
          if (preferredIsActive) {
            state.selectedVoiceId = preferredVoiceId;
          } else if (state.selectedVoiceId === null && voices.length > 0) {
            state.selectedVoiceId = voices[0].id;
          }
        });
      } catch (err) {
        set((state) => {
          state.status = 'error';
          state.error = err instanceof Error ? err.message : 'Failed to load voices.';
        });
      }
    },

    selectVoice: (userId, voiceId) => {
      set((state) => {
        state.selectedVoiceId = voiceId;
        state.selectVoiceStatus = 'loading';
        state.error = null;
      });
      // Best-effort: remember this pick as the default for next time. Unlike
      // toggleFavorite's optimistic rollback, a failed write here shouldn't
      // undo the user's current-session selection (selectedVoiceId stays as
      // set above) — only the "remembered for next time" part failed, so
      // just surface it via its own status rather than the catalog-load
      // status, so the error is actually renderable by the UI.
      setPreferredVoiceId(userId, voiceId)
        .then(() => {
          set((state) => {
            state.selectVoiceStatus = 'success';
          });
        })
        .catch((err) => {
          set((state) => {
            state.selectVoiceStatus = 'error';
            state.error = err instanceof Error ? err.message : 'Failed to save voice preference.';
          });
        });
    },
  }))
);
