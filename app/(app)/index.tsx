import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../src/hooks/useAuth';

export default function HomeScreen() {
  const user = useUser();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const displayName = user?.user_metadata?.display_name ?? 'there';

  // NFR-03: cap content width on wide viewports (web/tablet) instead of
  // stretching edge-to-edge; mobile just uses most of the available width.
  const contentWidth = Math.min(width * 0.9, 480);

  return (
    <View style={styles.container}>
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
          style={styles.ctaButton}
          onPress={() => router.push('/prompt')}
          accessibilityRole="button"
          accessibilityLabel="Start a meditation"
        >
          <Text style={styles.ctaButtonText}>Start a Meditation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
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
  },
  content: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  ctaButton: {
    backgroundColor: '#4b5563',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
