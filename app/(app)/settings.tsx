import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignOut, useUser } from '../../src/hooks/useAuth';
import { colors, radius } from '../../src/theme/colors';

export default function SettingsScreen() {
  const user = useUser();
  const signOut = useSignOut();

  const handleLogOut = async () => {
    await signOut();
  }

  return (
    <LinearGradient colors={[colors.backgroundGlow, colors.background]} style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Display name</Text>
      <Text style={styles.value}>
        {user?.user_metadata?.display_name ?? '-'}
      </Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{user?.email ?? '-'}</Text>

      <TouchableOpacity
        style={[styles.button, platformGlow]}
        onPress={handleLogOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
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
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 24,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    marginTop: 2,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
