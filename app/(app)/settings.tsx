import {
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
} from 'react-native';
import { useSignOut, useUser } from '../../src/hooks/useAuth';

export default function SettingsScreen() {
  const user = useUser();
  const signOut = useSignOut();

  const handleLogOut = async () => {
    await signOut();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Display name</Text>
      <Text style={styles.value}>
        {user?.user_metadata?.display_name ?? '-'}
      </Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{user?.email ?? '-'}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

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
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    marginTop: 2,
  },
  button: {
    backgroundColor: '#4b5563',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

