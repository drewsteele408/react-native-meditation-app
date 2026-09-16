jest.mock('../repositories/geminiRepository');
jest.mock('../repositories/elevenLabsRepository');

import { useMeditationStore } from './meditationStore';
import * as geminiRepository from '../repositories/geminiRepository';
import * as elevenLabsRepository from '../repositories/elevenLabsRepository';

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

describe('meditationStore.reset', () => {
  it('clears generation state back to initial values', () => {
    useMeditationStore.setState({
      prompt: 'something',
      sessionId: 'session-123',
      script: 'a script',
      scriptStatus: 'success',
      audioUrl: 'https://audio.url/file.mp3',
      audioStatus: 'success',
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
    expect(state.error).toBeNull();
  });
});
