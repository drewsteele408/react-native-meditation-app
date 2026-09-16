jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(),
  })),
}));

jest.mock('../repositories/supabaseRepository');

import { useAudioStore } from './audioStore';
import { useMeditationStore } from './meditationStore';
import * as supabaseRepository from '../repositories/supabaseRepository';

const initialState = useAudioStore.getState();
const FORTY_FIVE_MIN_MS = 45 * 60 * 1000;

beforeEach(() => {
  useAudioStore.setState(initialState, true);
  useMeditationStore.setState({ sessionId: 'session-123' });
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('audioStore.load', () => {
  it('sets audioUrl and stamps urlGeneratedAt with the current time', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    useAudioStore.getState().load('https://audio.url/file.mp3');

    const state = useAudioStore.getState();
    expect(state.audioUrl).toBe('https://audio.url/file.mp3');
    expect(state.urlGeneratedAt).toBe(now);
    expect(state.status).toBe('ready');
  });
});

describe('audioStore.play', () => {
  it('does not refresh the URL when called within the 45-minute threshold', async () => {
    const loadedAt = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(loadedAt);
    useAudioStore.getState().load('https://audio.url/file.mp3');

    jest.spyOn(Date, 'now').mockReturnValue(loadedAt + FORTY_FIVE_MIN_MS - 60_000);
    await useAudioStore.getState().play();

    expect(supabaseRepository.refreshAudioUrl).not.toHaveBeenCalled();
    expect(useAudioStore.getState().audioUrl).toBe('https://audio.url/file.mp3');
    expect(useAudioStore.getState().isPlaying).toBe(true);
  });

  it('refreshes the URL when called after the 45-minute threshold', async () => {
    const loadedAt = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(loadedAt);
    useAudioStore.getState().load('https://audio.url/file.mp3');

    (supabaseRepository.refreshAudioUrl as jest.Mock).mockResolvedValue(
      'https://audio.url/fresh.mp3'
    );

    const resumedAt = loadedAt + FORTY_FIVE_MIN_MS + 60_000;
    jest.spyOn(Date, 'now').mockReturnValue(resumedAt);
    await useAudioStore.getState().play();

    expect(supabaseRepository.refreshAudioUrl).toHaveBeenCalledWith('session-123');
    const state = useAudioStore.getState();
    expect(state.audioUrl).toBe('https://audio.url/fresh.mp3');
    expect(state.urlGeneratedAt).toBe(resumedAt);
    expect(state.isPlaying).toBe(true);
  });

  it('sets status to error and does not play if the refresh fails', async () => {
    const loadedAt = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(loadedAt);
    useAudioStore.getState().load('https://audio.url/file.mp3');

    (supabaseRepository.refreshAudioUrl as jest.Mock).mockRejectedValue(
      new Error('Signed URL fetch failed')
    );

    jest.spyOn(Date, 'now').mockReturnValue(loadedAt + FORTY_FIVE_MIN_MS + 60_000);
    await useAudioStore.getState().play();

    const state = useAudioStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Signed URL fetch failed');
    expect(state.isPlaying).toBe(false);
  });
});
