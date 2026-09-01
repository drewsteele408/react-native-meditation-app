import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuthError, useAuthStatus, useSignIn } from '../../src/hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const status = useAuthStatus();
  const error = useAuthError();
  const signIn = useSignIn();

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // NFR-03: cap form width on wide viewports (web/tablet) instead of
  // stretching inputs edge-to-edge; mobile just uses full width.
  const formWidth = isWeb ? Math.min(width * 0.9, 420) : width * 0.9;

  const isLoading = status === 'loading';

  const handleLogIn = () => {
    signIn(email, password);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.form, { width: formWidth }]}>
        <Text style={styles.title}>Log In</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          accessibilityLabel="Email address"
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          accessibilityLabel="Password"
        />

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator
            style={styles.spinner}
            accessibilityLabel="Logging in"
          />
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogIn}
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>
        )}

        <Link
          href="/register"
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel="Go to create account screen"
        >
          <Text style={styles.linkText}>Don&apos;t have an account? Register</Text>
        </Link>
      </View>
    </View>
  );
}

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
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4b5563',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 8,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 12,
  },
  link: {
    marginTop: 20,
    alignSelf: 'center',
  },
  linkText: {
    color: '#2563eb',
    textAlign: 'center',
  },
});
