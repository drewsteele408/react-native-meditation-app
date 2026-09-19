import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../src/hooks/useAuth';
import { colors, radius } from '../../src/theme/colors';

export default function HomeScreen() {
  const user = useUser();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const displayName = user?.user_metadata?.display_name ?? 'there';

  // NFR-03: cap content width on wide viewports (web/tablet) instead of
  // stretching edge-to-edge; mobile just uses most of the available width.
  const contentWidth = Math.min(width * 0.9, 480);

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

      <View style={[styles.content, { width: contentWidth }]}>
        <Text style={styles.greeting}>Hello, {displayName}</Text>
        <Text style={styles.subtitle}>Ready for a moment of calm?</Text>

        <TouchableOpacity
          style={[styles.ctaButton, platformGlow]}
          onPress={() => router.push('/prompt')}
          accessibilityRole="button"
          accessibilityLabel="Start a meditation"
        >
          <Text style={styles.ctaButtonText}>Start a Meditation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/library')}
          accessibilityRole="button"
          accessibilityLabel="View saved meditations"
        >
          <Text style={styles.secondaryButtonText}>Saved Meditations</Text>
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
  content: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '600',
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
});
