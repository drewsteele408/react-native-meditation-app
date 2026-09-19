import { useMeditationStore } from '../stores/meditationStore';

export const usePrompt = () => useMeditationStore((state) => state.prompt);
export const useSessionId = () => useMeditationStore((state) => state.sessionId);
export const useScript = () => useMeditationStore((state) => state.script);
export const useScriptStatus = () => useMeditationStore((state) => state.scriptStatus);
export const useMeditationAudioUrl = () => useMeditationStore((state) => state.audioUrl);
export const useAudioGenerationStatus = () => useMeditationStore((state) => state.audioStatus);
export const useMeditationError = () => useMeditationStore((state) => state.error);
export const useIsFavorite = () => useMeditationStore((state) => state.isFavorite);
export const useFavoriteStatus = () => useMeditationStore((state) => state.favoriteStatus);
export const useSetPrompt = () => useMeditationStore((state) => state.setPrompt);
export const useGenerate = () => useMeditationStore((state) => state.generate);
export const useLoadSession = () => useMeditationStore((state) => state.loadSession);
export const useToggleFavorite = () => useMeditationStore((state) => state.toggleFavorite);
export const useResetMeditation = () => useMeditationStore((state) => state.reset);
