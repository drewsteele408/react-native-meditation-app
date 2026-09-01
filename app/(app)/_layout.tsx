import { Stack } from 'expo-router';

// No auth redirect logic here — access to this entire group is already
// gated by Stack.Protected in the root layout (app/_layout.tsx).
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
