import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAudioGenerationStatus,
  useGenerate,
  useMeditationError,
  usePrompt,
  useScriptStatus,
  useSetPrompt,
} from '../../src/hooks/useMeditation';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { colors, radius } from '../../src/theme/colors';

const MAX_PROMPT_LENGTH = 1000; // mirrors SEC-02
const DURATION_OPTIONS = [5, 10, 15] as const;

export default function PromptScreen() {
  const prompt = usePrompt();
  const setPrompt = useSetPrompt();
  const scriptStatus = useScriptStatus();
  const audioStatus = useAudioGenerationStatus();
  const error = useMeditationError();
  const generate = useGenerate();
  const isOffline = useNetworkStatus();

  const [durationMinutes, setDurationMinutes] = useState<number>(10);

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // NFR-03: cap form width on wide viewports (web/tablet); mobile uses most
  // of the screen width. Matches the pattern used on the auth screens.
  const formWidth = isWeb ? Math.min(width * 0.9, 480) : width * 0.9;

  const isGenerating = scriptStatus === 'loading';
  // scriptStatus flips to 'success' (and this screen navigates away) before
  // audioStatus starts 'loading' — spec §9.7 sequencing — so this branch is
  // only visible for the brief moment between script success and the
  // navigation effect below firing.
  const isPreparingAudio = scriptStatus === 'success' && audioStatus === 'loading';
  const hasError = scriptStatus === 'error' || audioStatus === 'error';
  const canGenerate = !isGenerating && !isOffline && prompt.trim().length > 0;

  // Navigate to Playback as soon as the script is ready. The Playback
  // screen itself owns showing "Preparing audio…" for as long as
  // audioStatus stays 'loading' after that.
  useEffect(() => {
    if (scriptStatus === 'success') {
      router.push('/playback');
    }
  }, [scriptStatus]);

  const handleGenerate = () => {
    if (!canGenerate) return;
    generate(prompt, durationMinutes);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={[colors.backgroundGlow, colors.background]} style={styles.container}>
        <View style={[styles.form, { width: formWidth }]}>
        <Text style={styles.title}>What&apos;s on your mind?</Text>

        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="I'm feeling anxious and want to calm down…"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={MAX_PROMPT_LENGTH}
          textAlignVertical="top"
          accessibilityLabel="Meditation prompt"
          accessibilityHint="Describe how you're feeling or what you want from this meditation"
        />
        <Text
          style={[
            styles.charCount,
            prompt.length > MAX_PROMPT_LENGTH * 0.9 && styles.charCountWarning,
          ]}
        >
          {prompt.length}/{MAX_PROMPT_LENGTH}
        </Text>

        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((minutes) => {
            const selected = durationMinutes === minutes;
            return (
              <TouchableOpacity
                key={minutes}
                style={[styles.durationButton, selected && styles.durationButtonSelected]}
                onPress={() => setDurationMinutes(minutes)}
                accessibilityRole="button"
                accessibilityLabel={`${minutes} minute meditation`}
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    selected && styles.durationButtonTextSelected,
                  ]}
                >
                  {minutes} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

        {isPreparingAudio ? (
          <View style={styles.statusRow}>
            <ActivityIndicator accessibilityLabel="Preparing audio" />
            <Text style={styles.statusText}>Preparing audio…</Text>
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
    </TouchableWithoutFeedback>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 140,
    color: colors.textPrimary,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  charCountWarning: {
    color: colors.error,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  durationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationButtonText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  durationButtonTextSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
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
    marginTop: 4,
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
