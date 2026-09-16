// Dummy values so src/lib/supabaseClient.ts's createClient() call doesn't
// throw when a repository module gets loaded (directly or via automock)
// during tests — no real network calls happen at construction time.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

// supabaseClient.ts imports AsyncStorage for session persistence; there's no
// native module bridge in the Jest environment, so use the package's own
// official mock (see https://react-native-async-storage.github.io/async-storage/docs/advanced/jest).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
