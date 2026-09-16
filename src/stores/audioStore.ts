import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { refreshAudioUrl } from '../repositories/supabaseRepository';
import { useMeditationStore } from './meditationStore';

// spec §9.13: refresh signed URLs 15 minutes before their 1-hour expiry
const URL_REFRESH_THRESHOLD_MS = 45 * 60 * 1000;

export type AudioPlaybackStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AudioStore {
  audioUrl: string | null;
  urlGeneratedAt: number | null;
  isPlaying: boolean;
  status: AudioPlaybackStatus;
  error: string | null;
  load: (url: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  unload: () => void;
}

// The player is intentionally kept outside Zustand state (spec §9.13:
// "the store owns a player ... lives on the store instance itself, not in
// state"). It's created imperatively with createAudioPlayer() — never the
// useAudioPlayer hook, whose player is auto-released on unmount.
let player: AudioPlayer = createAudioPlayer();

export function getAudioPlayer(): AudioPlayer {
  return player;
}

export const useAudioStore = create<AudioStore>()(
  immer((set, get) => ({
    audioUrl: null,
    urlGeneratedAt: null,
    isPlaying: false,
    status: 'idle',
    error: null,

    load: (url) => {
      player.replace(url);
      set((state) => {
        state.audioUrl = url;
        state.urlGeneratedAt = Date.now();
        state.status = 'ready';
        state.isPlaying = false;
        state.error = null;
      });
    },

    play: async () => {
      const { audioUrl, urlGeneratedAt } = get();
      if (!audioUrl || !urlGeneratedAt) return;

      if (Date.now() - urlGeneratedAt > URL_REFRESH_THRESHOLD_MS) {
        const sessionId = useMeditationStore.getState().sessionId;
        if (!sessionId) return;

        set((state) => {
          state.status = 'loading';
        });
        try {
          const freshUrl = await refreshAudioUrl(sessionId);
          player.replace(freshUrl);
          set((state) => {
            state.audioUrl = freshUrl;
            state.urlGeneratedAt = Date.now();
            state.status = 'ready';
          });
        } catch (err) {
          set((state) => {
            state.status = 'error';
            state.error = err instanceof Error ? err.message : 'Failed to refresh audio URL.';
          });
          return;
        }
      }

      player.play();
      set((state) => {
        state.isPlaying = true;
      });
    },

    pause: () => {
      player.pause();
      set((state) => {
        state.isPlaying = false;
      });
    },

    stop: () => {
      player.pause();
      player.seekTo(0);
      set((state) => {
        state.isPlaying = false;
      });
    },

    seekTo: (seconds) => {
      player.seekTo(seconds);
    },

    unload: () => {
      player.remove();
      player = createAudioPlayer();
      set((state) => {
        state.audioUrl = null;
        state.urlGeneratedAt = null;
        state.isPlaying = false;
        state.status = 'idle';
        state.error = null;
      });
    },
  }))
);
