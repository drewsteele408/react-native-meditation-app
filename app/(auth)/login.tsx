import { useState } from 'react';
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
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthError, useAuthStatus, useSignIn } from '../../src/hooks/useAuth';
import { colors, radius } from '../../src/theme/colors';

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={[colors.backgroundGlow, colors.background]} style={styles.container}>
        <View style={[styles.form, { width: formWidth }]}>
        <Text style={styles.title}>Log In</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
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
          placeholderTextColor={colors.placeholder}
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
            color={colors.primary}
          />
        ) : (
          <TouchableOpacity
            style={[styles.button, platformGlow]}
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
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 24,
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
    marginBottom: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...platformGlow,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 8,
  },
  errorText: {
    color: colors.error,
    marginBottom: 12,
  },
  link: {
    marginTop: 20,
    alignSelf: 'center',
  },
  linkText: {
    color: colors.accentLight,
    textAlign: 'center',
  },
});
