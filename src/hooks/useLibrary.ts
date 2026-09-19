import { useLibraryStore } from '../stores/libraryStore';

export const useFavorites = () => useLibraryStore((state) => state.favorites);
export const useLibraryStatus = () => useLibraryStore((state) => state.status);
export const useLibraryError = () => useLibraryStore((state) => state.error);
export const useLoadFavorites = () => useLibraryStore((state) => state.loadFavorites);
