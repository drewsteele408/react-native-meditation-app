import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFavorites,
  useLibraryError,
  useLibraryStatus,
  useLoadFavorites,
} from '../../src/hooks/useLibrary';
import { MeditationSession } from '../../src/types';
import { colors } from '../../src/theme/colors';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LibraryScreen() {
  const favorites = useFavorites();
  const status = useLibraryStatus();
  const error = useLibraryError();
  const loadFavorites = useLoadFavorites();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // NFR-03: cap list width on wide viewports instead of stretching edge-to-edge.
  const contentWidth = Math.min(width * 0.92, 560);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const handleBack = () => router.back();

  const handleOpenSession = (item: MeditationSession) => {
    router.push({ pathname: '/playback', params: { sessionId: item.id } });
  };

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator accessibilityLabel="Loading saved meditations" />
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error ?? 'Something went wrong loading your saved meditations.'}
          </Text>
        </View>
      );
    }

    if (favorites.length === 0) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.emptyText}>
            No saved meditations yet — tap the heart during playback to save one.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { width: contentWidth }]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => handleOpenSession(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open saved meditation: ${item.prompt}`}
          >
            <Text style={styles.rowPrompt} numberOfLines={2}>
              {item.prompt}
            </Text>
            <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <LinearGradient
      colors={[colors.backgroundGlow, colors.background]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Saved Meditations</Text>
      </View>

      {renderContent()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accentLight,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPrompt: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  rowDate: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
});
