import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../theme/colors';

interface BackButtonProps {
  disabled?: boolean;
}

// Back arrow shown at the top of each step in the create-meditation flow
// (Duration, Voice). Matches the "‹ Back" style used on Library/Playback.
export function BackButton({ disabled = false }: BackButtonProps) {
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      accessibilityState={{ disabled }}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.text}>‹ Back</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 16,
    color: colors.accentLight,
  },
});
