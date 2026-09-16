import { useAudioStore, getAudioPlayer } from '../stores/audioStore';

// Not a Zustand selector — the player is a plain module-level singleton
// (spec §9.13), so screens get the live instance to pass into
// useAudioPlayerStatus(player) themselves. Position/duration are never
// mirrored into the store.
export const usePlayer = () => getAudioPlayer();

export const useCurrentAudioUrl = () => useAudioStore((state) => state.audioUrl);
export const useIsPlaying = () => useAudioStore((state) => state.isPlaying);
export const useAudioPlaybackStatus = () => useAudioStore((state) => state.status);
export const useAudioError = () => useAudioStore((state) => state.error);
export const useLoadAudio = () => useAudioStore((state) => state.load);
export const usePlay = () => useAudioStore((state) => state.play);
export const usePause = () => useAudioStore((state) => state.pause);
export const useStop = () => useAudioStore((state) => state.stop);
export const useSeekTo = () => useAudioStore((state) => state.seekTo);
export const useUnloadAudio = () => useAudioStore((state) => state.unload);
