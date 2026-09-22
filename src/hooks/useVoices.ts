import { useVoiceStore } from '../stores/voiceStore';
import { getVoicePreviewUrl } from '../repositories/voicesRepository';

export const useVoices = () => useVoiceStore((state) => state.voices);
export const useVoicesStatus = () => useVoiceStore((state) => state.status);
export const useVoicesError = () => useVoiceStore((state) => state.error);
export const useSelectedVoiceId = () => useVoiceStore((state) => state.selectedVoiceId);
export const useSelectVoiceStatus = () => useVoiceStore((state) => state.selectVoiceStatus);
export const useLoadVoices = () => useVoiceStore((state) => state.loadVoices);
export const useSelectVoice = () => useVoiceStore((state) => state.selectVoice);

// voicesRepository.getVoicePreviewUrl is synchronous/stateless (just builds
// a public Storage URL, no request), but components must still go through
// the hooks layer rather than importing src/repositories/* directly (spec
// §9.3/§9.12) — this re-export is that boundary. Deliberately NOT named
// useVoicePreviewUrl: it's a plain function called from event handlers
// (see prompt.tsx's preview-tap handler), and a `use`-prefixed name there
// would trip the react-hooks lint rule's "hooks can only be called from
// component bodies" check even though this isn't a hook.
export { getVoicePreviewUrl };
