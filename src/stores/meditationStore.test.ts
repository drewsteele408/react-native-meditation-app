jest.mock('../repositories/geminiRepository');
jest.mock('../repositories/elevenLabsRepository');
jest.mock('../repositories/supabaseRepository');

import { useMeditationStore } from './meditationStore';
import * as geminiRepository from '../repositories/geminiRepository';
import * as elevenLabsRepository from '../repositories/elevenLabsRepository';
import * as supabaseRepository from '../repositories/supabaseRepository';

const initialState = useMeditationStore.getState();

beforeEach(() => {
  useMeditationStore.setState(initialState, true);
  jest.clearAllMocks();
});

describe('meditationStore.generate — happy path', () => {
  it('sequences scriptStatus to success before audioStatus resolves', async () => {
    (geminiRepository.generateScript as jest.Mock).mockResolvedValue({
      sessionId: 'session-123',
      script: 'A calm meditation...',
    });
    (elevenLabsRepository.synthesizeSpeech as jest.Mock).mockResolvedValue(
      'https://audio.url/file.mp3'
    );

    await useMeditationStore.getState().generate('I feel anxious', 10);

    const state = useMeditationStore.getState();
    expect(geminiRepository.generateScript).toHaveBeenCalledWith('I feel anxious', 10);
    expect(elevenLabsRepository.synthesizeSpeech).toHaveBeenCalledWith('session-123');
    expect(state.scriptStatus).toBe('success');
    expect(state.sessionId).toBe('session-123');
    expect(state.script).toBe('A calm meditation...');
    expect(state.audioStatus).toBe('success');
    expect(state.audioUrl).toBe('https://audio.url/file.mp3');
    expect(state.error).toBeNull();
  });
});

describe('meditationStore.generate — Gemini failure', () => {
  it('sets scriptStatus to error and never calls ElevenLabs', async () => {
    (geminiRepository.generateScript as jest.Mock).mockRejectedValue(
      new Error('Quota exceeded')
    );

    await useMeditationStore.getState().generate('I feel anxious');

    const state = useMeditationStore.getState();
    expect(state.scriptStatus).toBe('error');
    expect(state.error).toBe('Quota exceeded');
    expect(state.audioStatus).toBe('idle');
    expect(elevenLabsRepository.synthesizeSpeech).not.toHaveBeenCalled();
  });
});

describe('meditationStore.generate — ElevenLabs failure', () => {
  it('keeps the successful script but sets audioStatus to error', async () => {
    (geminiRepository.generateScript as jest.Mock).mockResolvedValue({
      sessionId: 'session-123',
      script: 'A calm meditation...',
    });
    (elevenLabsRepository.synthesizeSpeech as jest.Mock).mockRejectedValue(
      new Error('TTS unavailable')
    );

    await useMeditationStore.getState().generate('I feel anxious');

    const state = useMeditationStore.getState();
    expect(state.scriptStatus).toBe('success');
    expect(state.script).toBe('A calm meditation...');
    expect(state.audioStatus).toBe('error');
    expect(state.error).toBe('TTS unavailable');
  });
});

describe('meditationStore.generate — re-entrancy guard', () => {
  it('ignores a second call while scriptStatus is already loading', async () => {
    let resolveGenerate!: (value: { sessionId: string; script: string }) => void;
    (geminiRepository.generateScript as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveGenerate = resolve;
      })
    );

    const firstCall = useMeditationStore.getState().generate('I feel anxious');
    const secondCall = useMeditationStore.getState().generate('A different prompt');

    resolveGenerate({ sessionId: 'session-123', script: 'A calm meditation...' });
    await Promise.all([firstCall, secondCall]);

    expect(geminiRepository.generateScript).toHaveBeenCalledTimes(1);
  });
});

describe('meditationStore.loadSession — happy path', () => {
  it('loads the script and favorite flag, then refreshes the audio URL', async () => {
    (supabaseRepository.getSession as jest.Mock).mockResolvedValue({
      id: 'session-123',
      script: 'A calm meditation...',
      is_favorite: true,
    });
    (supabaseRepository.refreshAudioUrl as jest.Mock).mockResolvedValue(
      'https://audio.url/refreshed.mp3'
    );

    await useMeditationStore.getState().loadSession('session-123');

    const state = useMeditationStore.getState();
    expect(supabaseRepository.getSession).toHaveBeenCalledWith('session-123');
    expect(supabaseRepository.refreshAudioUrl).toHaveBeenCalledWith('session-123');
    expect(state.scriptStatus).toBe('success');
    expect(state.sessionId).toBe('session-123');
    expect(state.script).toBe('A calm meditation...');
    expect(state.isFavorite).toBe(true);
    expect(state.audioStatus).toBe('success');
    expect(state.audioUrl).toBe('https://audio.url/refreshed.mp3');
  });
});

describe('meditationStore.loadSession — missing audio', () => {
  it('keeps the loaded script but sets audioStatus to error', async () => {
    (supabaseRepository.getSession as jest.Mock).mockResolvedValue({
      id: 'session-123',
      script: 'A calm meditation...',
      is_favorite: false,
    });
    (supabaseRepository.refreshAudioUrl as jest.Mock).mockRejectedValue(
      new Error('Session has no audio to refresh.')
    );

    await useMeditationStore.getState().loadSession('session-123');

    const state = useMeditationStore.getState();
    expect(state.scriptStatus).toBe('success');
    expect(state.audioStatus).toBe('error');
    expect(state.error).toBe('Session has no audio to refresh.');
  });
});

describe('meditationStore.loadSession — session fetch failure', () => {
  it('clears any stale session-scoped fields instead of leaving a prior session mixed in', async () => {
    useMeditationStore.setState({
      sessionId: 'stale-session',
      script: 'stale script',
      isFavorite: true,
      audioUrl: 'https://audio.url/stale.mp3',
    });
    (supabaseRepository.getSession as jest.Mock).mockRejectedValue(new Error('Not found'));

    await useMeditationStore.getState().loadSession('session-456');

    const state = useMeditationStore.getState();
    expect(state.scriptStatus).toBe('error');
    expect(state.error).toBe('Not found');
    expect(state.sessionId).toBeNull();
    expect(state.script).toBeNull();
    expect(state.isFavorite).toBe(false);
    expect(state.audioUrl).toBeNull();
    expect(supabaseRepository.refreshAudioUrl).not.toHaveBeenCalled();
  });
});

describe('meditationStore.toggleFavorite', () => {
  it('optimistically flips isFavorite and persists it', async () => {
    (supabaseRepository.setFavorite as jest.Mock).mockResolvedValue(undefined);
    useMeditationStore.setState({ sessionId: 'session-123', isFavorite: false });

    await useMeditationStore.getState().toggleFavorite();

    expect(supabaseRepository.setFavorite).toHaveBeenCalledWith('session-123', true);
    expect(useMeditationStore.getState().isFavorite).toBe(true);
  });

  it('reverts isFavorite if the persist call fails', async () => {
    (supabaseRepository.setFavorite as jest.Mock).mockRejectedValue(new Error('Network error'));
    useMeditationStore.setState({ sessionId: 'session-123', isFavorite: false });

    await useMeditationStore.getState().toggleFavorite();

    const state = useMeditationStore.getState();
    expect(state.isFavorite).toBe(false);
    expect(state.error).toBe('Network error');
  });

  it('does nothing without an active sessionId', async () => {
    useMeditationStore.setState({ sessionId: null, isFavorite: false });

    await useMeditationStore.getState().toggleFavorite();

    expect(supabaseRepository.setFavorite).not.toHaveBeenCalled();
  });

  it('ignores a second call while the first toggle is still in flight', async () => {
    let resolveSetFavorite!: () => void;
    (supabaseRepository.setFavorite as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSetFavorite = resolve;
      })
    );
    useMeditationStore.setState({ sessionId: 'session-123', isFavorite: false });

    const firstCall = useMeditationStore.getState().toggleFavorite();
    const secondCall = useMeditationStore.getState().toggleFavorite();

    resolveSetFavorite();
    await Promise.all([firstCall, secondCall]);

    expect(supabaseRepository.setFavorite).toHaveBeenCalledTimes(1);
  });

  it('does not corrupt a different session that was loaded while the toggle was in flight', async () => {
    let rejectSetFavorite!: (err: Error) => void;
    (supabaseRepository.setFavorite as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSetFavorite = reject;
      })
    );
    useMeditationStore.setState({ sessionId: 'session-A', isFavorite: false });

    const toggleCall = useMeditationStore.getState().toggleFavorite();

    // Simulate the user navigating away and loadSession() landing on a
    // different session before the in-flight toggle resolves.
    useMeditationStore.setState({ sessionId: 'session-B', isFavorite: true });

    rejectSetFavorite(new Error('Network error'));
    await toggleCall;

    const state = useMeditationStore.getState();
    expect(state.sessionId).toBe('session-B');
    expect(state.isFavorite).toBe(true);
    expect(state.error).toBeNull();
  });
});

describe('meditationStore.reset', () => {
  it('clears generation state back to initial values', () => {
    useMeditationStore.setState({
      prompt: 'something',
      sessionId: 'session-123',
      script: 'a script',
      scriptStatus: 'success',
      audioUrl: 'https://audio.url/file.mp3',
      audioStatus: 'success',
      isFavorite: true,
      error: 'stale error',
    });

    useMeditationStore.getState().reset();

    const state = useMeditationStore.getState();
    expect(state.prompt).toBe('');
    expect(state.sessionId).toBeNull();
    expect(state.script).toBeNull();
    expect(state.scriptStatus).toBe('idle');
    expect(state.audioUrl).toBeNull();
    expect(state.audioStatus).toBe('idle');
    expect(state.isFavorite).toBe(false);
    expect(state.error).toBeNull();
  });
});
