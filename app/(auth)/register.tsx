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
import { Link, router } from 'expo-router';
import { useAuthError, useAuthStatus, useSignUp } from '../../src/hooks/useAuth';
import { useAuthStore } from '../../src/stores/authStore';

const MIN_PASSWORD_LENGTH = 8; // FR-AUTH-05

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const status = useAuthStatus();
  const authError = useAuthError();
  const signUp = useSignUp();

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // NFR-03: cap form width on wide viewports (web/tablet) instead of
  // stretching inputs edge-to-edge; mobile just uses full width.
  const formWidth = isWeb ? Math.min(width * 0.9, 420) : width * 0.9;

  const isLoading = status === 'loading';

  const handleCreateAccount = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    setValidationError(null);

    await signUp(email, password, displayName);

    // Supabase's auth-state-change event can take a moment to propagate to
    // the root layout's Stack.Protected guard, so navigate explicitly once
    // signUp actually produced a session. Read the store imperatively here
    // rather than via hooks, since this runs after an await inside an event
    // handler, not during render. Checking session (not just the absence of
    // an error) matters because if Supabase's "Confirm email" setting is
    // enabled, signUp resolves with no error but no session either.
    const { session } = useAuthStore.getState();
    if (session) {
      router.replace('/(app)/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.form, { width: formWidth }]}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          autoCapitalize="words"
          accessibilityLabel="Display name"
        />

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
          onChangeText={(text) => {
            setPassword(text);
            if (validationError) setValidationError(null);
          }}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          accessibilityLabel="Password"
          accessibilityHint="Must be at least 8 characters"
        />

        {validationError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {validationError}
          </Text>
        ) : null}

        {authError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {authError}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator
            style={styles.spinner}
            accessibilityLabel="Creating account"
          />
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleCreateAccount}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>
        )}

        <Link
          href="/login"
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel="Go to log in screen"
        >
          <Text style={styles.linkText}>Already have an account? Log in</Text>
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
