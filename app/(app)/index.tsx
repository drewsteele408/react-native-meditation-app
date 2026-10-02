import { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../src/hooks/useAuth';
import { usePrompt, useSetPrompt } from '../../src/hooks/useMeditation';
import { useLoadVoices } from '../../src/hooks/useVoices';
import { AssistantOrb } from '../../src/components/AssistantOrb';
import { colors, radius } from '../../src/theme/colors';

const MAX_PROMPT_LENGTH = 1000; // mirrors SEC-02

// Step 1 of the create-meditation flow: Home (prompt) → Duration → Voice →
// Playback. Only the prompt is collected here.
export default function HomeScreen() {
  const user = useUser();
  const prompt = usePrompt();
  const setPrompt = useSetPrompt();
  const loadVoices = useLoadVoices();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const displayName = user?.user_metadata?.display_name ?? 'there';
  const canContinue = prompt.trim().length > 0;

  // NFR-03: cap content width on wide viewports (web/tablet) instead of
  // stretching edge-to-edge; mobile just uses most of the available width.
  const contentWidth = Math.min(width * 0.9, 480);
  const orbSize = Math.min(contentWidth, 340);

  // Warm the voice catalog now so the Voice step is ready when the user
  // gets there.
  // The Continue button always occupies its space and fades in, so the
  // centered orb above doesn't jump when the user starts typing.
  const continueOpacity = useRef(new Animated.Value(canContinue ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(continueOpacity, {
      toValue: canContinue ? 1 : 0,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [canContinue, continueOpacity]);

  useEffect(() => {
    if (user) {
      loadVoices(user.id);
    }
  }, [user, loadVoices]);

  const handleContinue = () => {
    if (!canContinue) return;
    Keyboard.dismiss();
    router.push('/duration');
  };

  return (
    <LinearGradient
      colors={[colors.backgroundGlow, colors.background]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={styles.settingsButton}
        >
          <Text style={styles.settingsIcon}>⚙︎</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={[styles.hero, { width: contentWidth }]}>
            <View style={[styles.orbStage, { height: orbSize }]}>
              <View style={styles.orbLayer}>
                <AssistantOrb size={orbSize} />
              </View>
              <Text style={styles.greeting}>Hello, {displayName}</Text>
              <Text style={styles.subtitle}>Ready for a moment of calm?</Text>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/library')}
              accessibilityRole="button"
              accessibilityLabel="View saved meditations"
            >
              <Text style={styles.secondaryButtonText}>Saved Meditations</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.composer, { width: contentWidth }]}>
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

            <Animated.View
              style={{ opacity: continueOpacity }}
              pointerEvents={canContinue ? 'auto' : 'none'}
              accessibilityElementsHidden={!canContinue}
              importantForAccessibility={canContinue ? 'auto' : 'no-hide-descendants'}
            >
              <TouchableOpacity
                style={[styles.continueButton, platformGlow]}
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel="Continue to choose a duration"
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

// Dark halo keeps the greeting legible where it crosses the orb's arcs.
const textShadow = {
  textShadowColor: colors.background,
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero fills the space above the composer so the composer sits at the
  // bottom of the screen; once content overflows, the whole page scrolls.
  hero: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  composer: {
    alignSelf: 'center',
  },
  // Greeting sits centered on top of the animated orb.
  orbStage: {
    justifyContent: 'center',
    marginBottom: 24,
  },
  orbLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
    ...textShadow,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    ...textShadow,
  },
  secondaryButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: colors.accentLight,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
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
    minHeight: 100,
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
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
