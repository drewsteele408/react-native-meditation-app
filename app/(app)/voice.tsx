import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Redirect, Stack, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../src/components/BackButton';
import {
  useAudioGenerationStatus,
  useDurationMinutes,
  useGenerate,
  useMeditationError,
  usePrompt,
  useScriptStatus,
} from '../../src/hooks/useMeditation';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useUser } from '../../src/hooks/useAuth';
import {
  getVoicePreviewUrl,
  useLastUsedVoiceId,
  useLoadVoices,
  useMarkVoiceUsed,
  useSelectedVoiceId,
  useSelectVoice,
  useSelectVoiceStatus,
  useVoices,
  useVoicesError,
  useVoicesStatus,
} from '../../src/hooks/useVoices';
import type { Voice } from '../../src/types';
import { colors, radius } from '../../src/theme/colors';

// Step 3 of the create-meditation flow: pick a voice, then Generate.
export default function VoiceScreen() {
  const prompt = usePrompt();
  const durationMinutes = useDurationMinutes();
  const scriptStatus = useScriptStatus();
  const audioStatus = useAudioGenerationStatus();
  const error = useMeditationError();
  const generate = useGenerate();
  const isOffline = useNetworkStatus();

  const user = useUser();
  const voices = useVoices();
  const voicesStatus = useVoicesStatus();
  const voicesError = useVoicesError();
  const selectedVoiceId = useSelectedVoiceId();
  const lastUsedVoiceId = useLastUsedVoiceId();
  const selectVoiceStatus = useSelectVoiceStatus();
  const loadVoices = useLoadVoices();
  const selectVoice = useSelectVoice();
  const markVoiceUsed = useMarkVoiceUsed();
  // Screen-scoped preview player: unlike audioStore's manually-managed
  // singleton (built for the long-lived meditation session player with
  // signed-URL refresh logic), preview clips are short and only ever needed
  // on this screen, so the auto-releasing useAudioPlayer hook is the right
  // fit — it tears itself down on unmount with no manual cleanup required.
  const previewPlayer = useAudioPlayer(null);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  // Which voice's sample is loaded and whether it should be playing. Tracked
  // as intent rather than read from previewStatus.playing so the button
  // flips to ⏸ immediately on tap, before the clip finishes buffering.
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // NFR-03: cap content width on wide viewports (web/tablet).
  const contentWidth = Math.min(width * 0.9, 480);

  const isGenerating = scriptStatus === 'loading';
  const hasError = scriptStatus === 'error' || audioStatus === 'error';
  const canGenerate =
    !isGenerating &&
    !isOffline &&
    selectedVoiceId !== null &&
    durationMinutes !== null &&
    prompt.trim().length > 0;

  const stopPreview = useCallback(() => {
    previewPlayer.pause();
    setIsPreviewPlaying(false);
  }, [previewPlayer]);

  // Navigate to Playback as soon as the script is ready (Playback owns the
  // "Preparing audio…" state from there). Dismiss the Duration/Voice steps
  // first so going back from Playback lands on Home, not mid-flow.
  useEffect(() => {
    if (scriptStatus === 'success') {
      stopPreview();
      router.dismissAll();
      router.push('/playback');
    }
  }, [scriptStatus, stopPreview]);

  // Rewind once a sample finishes so ▶ replays it from the top.
  useEffect(() => {
    if (previewStatus.didJustFinish) {
      setIsPreviewPlaying(false);
      previewPlayer.seekTo(0);
    }
  }, [previewStatus.didJustFinish, previewPlayer]);

  // Don't let the user leave mid-generation — the navigation effect above
  // only runs while this screen is mounted.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => isGenerating
      );
      return () => subscription.remove();
    }, [isGenerating])
  );

  // Reached without the earlier steps (e.g. a web refresh or deep link).
  if (prompt.trim().length === 0) {
    return <Redirect href="/" />;
  }
  if (durationMinutes === null) {
    return <Redirect href="/duration" />;
  }

  const handleGenerate = () => {
    if (!canGenerate || selectedVoiceId === null) return;
    stopPreview();
    markVoiceUsed(selectedVoiceId);
    generate(prompt, durationMinutes, selectedVoiceId);
  };

  const handleSelectVoice = (voice: Voice) => {
    if (!user || isGenerating) return;
    selectVoice(user.id, voice.id);
  };

  const handlePreviewVoice = (voice: Voice) => {
    if (!voice.preview_audio_path) return;
    if (previewVoiceId === voice.id) {
      // Same voice: toggle pause/resume on the already-loaded sample.
      if (isPreviewPlaying) {
        previewPlayer.pause();
        setIsPreviewPlaying(false);
      } else {
        previewPlayer.play();
        setIsPreviewPlaying(true);
      }
      return;
    }
    previewPlayer.replace(getVoicePreviewUrl(voice.preview_audio_path));
    previewPlayer.play();
    setPreviewVoiceId(voice.id);
    setIsPreviewPlaying(true);
  };

  const handleRetryVoices = () => {
    if (user) loadVoices(user.id);
  };

  const renderVoice = ({ item: voice }: { item: Voice }) => {
    const selected = selectedVoiceId === voice.id;
    const lastUsed = lastUsedVoiceId === voice.id;
    const previewing = previewVoiceId === voice.id && isPreviewPlaying;
    return (
      <View style={[styles.voiceItem, selected && styles.voiceItemSelected]}>
        <TouchableOpacity
          style={styles.voiceItemMain}
          onPress={() => handleSelectVoice(voice)}
          accessibilityRole="button"
          accessibilityLabel={lastUsed ? `${voice.display_name}, last used` : voice.display_name}
          accessibilityState={{ selected }}
        >
          <View style={styles.voiceNameRow}>
            <Text style={[styles.voiceName, selected && styles.voiceNameSelected]}>
              {voice.display_name}
            </Text>
            {lastUsed ? (
              <View style={[styles.lastUsedBadge, selected && styles.lastUsedBadgeSelected]}>
                <Text style={[styles.lastUsedText, selected && styles.lastUsedTextSelected]}>
                  Last used
                </Text>
              </View>
            ) : null}
          </View>
          {voice.description ? (
            <Text
              style={[styles.voiceDescription, selected && styles.voiceDescriptionSelected]}
            >
              {voice.description}
            </Text>
          ) : null}
        </TouchableOpacity>
        {voice.preview_audio_path ? (
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => handlePreviewVoice(voice)}
            accessibilityRole="button"
            accessibilityLabel={
              previewing ? `Pause ${voice.display_name} preview` : `Preview ${voice.display_name}`
            }
            accessibilityHint={
              previewing ? 'Pauses the voice sample' : 'Plays a short sample of this voice'
            }
          >
            <Text style={styles.previewButtonText}>{previewing ? '❚❚' : '▶'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={[colors.backgroundGlow, colors.background]}
      style={styles.container}
    >
      <Stack.Screen options={{ gestureEnabled: !isGenerating }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton disabled={isGenerating} />
      </View>

      <FlatList
        data={voices}
        keyExtractor={(voice) => voice.id}
        renderItem={renderVoice}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { width: contentWidth }]}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.title}>Choose a voice</Text>
            {voicesStatus === 'loading' ? (
              <ActivityIndicator size="small" accessibilityLabel="Loading voices" />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          voicesStatus === 'error' ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetryVoices}
              accessibilityRole="button"
              accessibilityLabel="Retry loading voices"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View
        style={[styles.footer, { width: contentWidth, paddingBottom: insets.bottom + 16 }]}
      >
        {(voicesStatus === 'error' || selectVoiceStatus === 'error') && voicesError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {voicesError}
          </Text>
        ) : null}

        {isOffline ? (
          <Text style={styles.offlineText} accessibilityRole="alert">
            No internet connection
          </Text>
        ) : null}

        {isGenerating ? (
          <View style={styles.statusRow}>
            <ActivityIndicator accessibilityLabel="Generating your meditation" />
            <Text style={styles.statusText}>Generating your meditation…</Text>
          </View>
        ) : null}

        {hasError && error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate}
          accessibilityRole="button"
          accessibilityLabel="Generate meditation"
          accessibilityState={{ disabled: !canGenerate }}
        >
          <Text style={styles.generateButtonText}>Generate</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// NFR-03: iOS and Android render elevated/glowing surfaces differently —
// shadow props on iOS, `elevation` on Android.
const platformGlow = {
  shadowColor: colors.primary,
  shadowOpacity: 0.4,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    alignSelf: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  voiceItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  voiceItemMain: {
    flex: 1,
    marginRight: 12,
  },
  voiceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceName: {
    fontSize: 17,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  voiceNameSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  lastUsedBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lastUsedBadgeSelected: {
    borderColor: colors.onPrimary,
  },
  lastUsedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentLight,
  },
  lastUsedTextSelected: {
    color: colors.onPrimary,
  },
  voiceDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  voiceDescriptionSelected: {
    color: colors.onPrimary,
    opacity: 0.85,
  },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  previewButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  retryButton: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: colors.accentLight,
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    alignSelf: 'center',
    paddingTop: 12,
  },
  offlineText: {
    color: colors.error,
    marginBottom: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
    ...platformGlow,
  },
  generateButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
