import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../src/lib/supabaseClient';
import { useSession, useSetSession } from '../src/hooks/useAuth';

export default function RootLayout() {
  const session = useSession();
  const setSession = useSetSession();

  useEffect(() => {
    // FR-TTS-04: without this, iOS silently mutes playback when the
    // hardware ring/silent switch is set to silent.
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession]);

  return (
    <>
      {/* Dark lavender theme everywhere now uses dark backgrounds, so the
          status bar icons/text need to render light. */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* FR-NAV-01: this is the only auth gate in the app — no router.replace
            in useEffect anywhere else. While status is 'loading' (pre-hydration),
            session is null, so the guard falls through to (auth); acceptable for
            this prototype phase per build-plan.md Phase 2. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
