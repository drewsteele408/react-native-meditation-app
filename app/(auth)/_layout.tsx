import { Stack } from 'expo-router';

// No auth redirect logic here — the root layout's Stack.Protected guard
// (app/_layout.tsx) is the single source of truth for auth gating.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
