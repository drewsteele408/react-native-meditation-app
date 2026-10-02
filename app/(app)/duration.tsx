import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../src/components/BackButton';
import {
  useDurationMinutes,
  usePrompt,
  useSetDurationMinutes,
} from '../../src/hooks/useMeditation';
import { colors, radius } from '../../src/theme/colors';

const DURATION_OPTIONS = [5, 10, 15] as const;

// Step 2 of the create-meditation flow: pick a length, then go straight on
// to the Voice step.
export default function DurationScreen() {
  const prompt = usePrompt();
  const durationMinutes = useDurationMinutes();
  const setDurationMinutes = useSetDurationMinutes();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // NFR-03: cap content width on wide viewports (web/tablet).
  const contentWidth = Math.min(width * 0.9, 480);

  // Reached without a prompt (e.g. a web refresh or deep link) — start over.
  if (prompt.trim().length === 0) {
    return <Redirect href="/" />;
  }

  const handleSelect = (minutes: number) => {
    setDurationMinutes(minutes);
    router.push('/voice');
  };

  return (
    <LinearGradient
      colors={[colors.backgroundGlow, colors.background]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton />
      </View>

      <View style={[styles.content, { width: contentWidth }]}>
        <Text style={styles.title}>How long?</Text>

        {DURATION_OPTIONS.map((minutes) => {
          const selected = durationMinutes === minutes;
          return (
            <TouchableOpacity
              key={minutes}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => handleSelect(minutes)}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minute meditation`}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionMinutes, selected && styles.optionTextSelected]}>
                {minutes}
              </Text>
              <Text style={[styles.optionUnit, selected && styles.optionTextSelected]}>
                minutes
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 24,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionMinutes: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  optionUnit: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.onPrimary,
  },
});
