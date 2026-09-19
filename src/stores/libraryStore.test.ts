jest.mock('../repositories/supabaseRepository');

import { useLibraryStore } from './libraryStore';
import * as supabaseRepository from '../repositories/supabaseRepository';

const initialState = useLibraryStore.getState();

beforeEach(() => {
  useLibraryStore.setState(initialState, true);
  jest.clearAllMocks();
});

describe('libraryStore.loadFavorites — happy path', () => {
  it('populates favorites and sets status to success', async () => {
    const favorites = [
      { id: 'session-1', is_favorite: true },
      { id: 'session-2', is_favorite: true },
    ];
    (supabaseRepository.listFavoriteSessions as jest.Mock).mockResolvedValue(favorites);

    await useLibraryStore.getState().loadFavorites();

    const state = useLibraryStore.getState();
    expect(state.status).toBe('success');
    expect(state.favorites).toBe(favorites);
    expect(state.error).toBeNull();
  });
});

describe('libraryStore.loadFavorites — failure', () => {
  it('sets status to error and surfaces the message', async () => {
    (supabaseRepository.listFavoriteSessions as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    await useLibraryStore.getState().loadFavorites();

    const state = useLibraryStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
  });
});
