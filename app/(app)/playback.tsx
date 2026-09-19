import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAudioGenerationStatus,
  useFavoriteStatus,
  useIsFavorite,
  useLoadSession,
  useMeditationAudioUrl,
  useMeditationError,
  useResetMeditation,
  useScript,
  useToggleFavorite,
} from '../../src/hooks/useMeditation';
import {
  useAudioError,
  useAudioPlaybackStatus,
  useIsPlaying,
  useLoadAudio,
  usePause,
  usePlay,
  usePlayer,
  useSeekTo,
  useStop,
  useUnloadAudio,
} from '../../src/hooks/useAudio';
import { colors } from '../../src/theme/colors';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlaybackScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const script = useScript();
  const meditationAudioUrl = useMeditationAudioUrl();
  const audioGenStatus = useAudioGenerationStatus();
  const meditationError = useMeditationError();
  const resetMeditation = useResetMeditation();
  const isFavorite = useIsFavorite();
  const favoriteStatus = useFavoriteStatus();
  const loadSession = useLoadSession();
  const toggleFavorite = useToggleFavorite();

  const player = usePlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const playbackStatus = useAudioPlaybackStatus();
  const isPlaying = useIsPlaying();
  const audioError = useAudioError();
  const loadAudio = useLoadAudio();
  const play = usePlay();
  const pause = usePause();
  const stop = useStop();
  const seekTo = useSeekTo();
  const unloadAudio = useUnloadAudio();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // NFR-03: cap script/control width on wide viewports instead of
  // stretching edge-to-edge.
  const contentWidth = Math.min(width * 0.92, 560);

  // Opening Playback directly for a previously-generated session (e.g. from
  // the Library screen) — sessionId is only present on that entry path.
  // The generate-then-navigate flow has no sessionId param and is untouched.
  useEffect(() => {
    if (typeof sessionId === 'string' && sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, loadSession]);

  // meditationStore.audioUrl (populated by generate() once ElevenLabs
  // synthesis succeeds) is what audioStore.load() needs — audioStore's own
  // audioUrl field only reflects what's already been loaded into the player.
  useEffect(() => {
    if (audioGenStatus === 'success' && meditationAudioUrl) {
      loadAudio(meditationAudioUrl);
    }
  }, [audioGenStatus, meditationAudioUrl, loadAudio]);

  // Rewind to the start once playback naturally finishes, so "Play" resumes
  // from the top instead of sitting at position === duration.
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      stop();
    }
  }, [playerStatus.didJustFinish, stop]);

  // FR-NAV-03: stop + release the player on unmount no matter how the
  // screen is left (back gesture, hardware back, tab switch, etc). unload()
  // calls player.remove() and swaps in a fresh player. Also reset the
  // meditation session here — spec §9.7 documents reset() as existing "for
  // when the user navigates away from playback" — so returning to the
  // Prompt screen later starts from a clean idle state instead of
  // immediately re-navigating to a stale finished session.
  useEffect(() => {
    return () => {
      unloadAudio();
      resetMeditation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = useCallback(() => {
    // Exit criteria calls this out explicitly: stop audio *before*
    // navigating away, not only as a side effect of the unmount cleanup
    // above. Covers both the rendered back button and the Android hardware
    // back press below.
    stop();
    router.back();
  }, [stop]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleBack])
  );

  const handleReplay = () => {
    seekTo(0);
    play();
  };

  const progress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;

  const renderControls = () => {
    if (audioGenStatus === 'error') {
      return (
        <Text style={styles.errorText} accessibilityRole="alert">
          {meditationError ?? 'Something went wrong preparing your audio.'}
        </Text>
      );
    }

    if (audioGenStatus !== 'success') {
      // 'idle' or 'loading' — synthesis hasn't finished yet.
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator accessibilityLabel="Preparing audio" />
          <Text style={styles.statusText}>Preparing audio…</Text>
        </View>
      );
    }

    if (playbackStatus === 'error') {
      return (
        <Text style={styles.errorText} accessibilityRole="alert">
          {audioError ?? 'Something went wrong playing your audio.'}
        </Text>
      );
    }

    if (playbackStatus === 'idle' || playbackStatus === 'loading') {
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator accessibilityLabel="Loading audio" />
          <Text style={styles.statusText}>
            {playbackStatus === 'loading' ? 'Refreshing audio link…' : 'Loading audio…'}
          </Text>
        </View>
      );
    }

    // playbackStatus === 'ready'
    return (
      <>
        <View style={styles.progressBarTrack}>
          <View
            style={[styles.progressBarFill, { width: `${Math.min(progress, 1) * 100}%` }]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(playerStatus.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(playerStatus.duration)}</Text>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleReplay}
            accessibilityRole="button"
            accessibilityLabel="Replay meditation"
          >
            <Text style={styles.controlButtonText}>⟲</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.playButton, platformElevation]}
            onPress={isPlaying ? pause : play}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause meditation' : 'Play meditation'}
          >
            <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={stop}
            accessibilityRole="button"
            accessibilityLabel="Stop meditation"
          >
            <Text style={styles.controlButtonText}>⏹</Text>
          </TouchableOpacity>
        </View>
      </>
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

        {audioGenStatus === 'success' ? (
          <TouchableOpacity
            onPress={toggleFavorite}
            disabled={favoriteStatus === 'loading'}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Unsave meditation' : 'Save meditation'}
            style={styles.favoriteButton}
          >
            <Text style={styles.favoriteButtonText}>{isFavorite ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.scriptScroll}
        contentContainerStyle={[styles.scriptContent, { width: contentWidth }]}
      >
        <Text style={styles.scriptText}>
          {script ?? 'Your meditation script will appear here.'}
        </Text>
      </ScrollView>

      <View style={[styles.controlsContainer, { width: contentWidth }]}>{renderControls()}</View>
    </LinearGradient>
  );
}

// NFR-03: iOS and Android render elevated/glowing surfaces differently —
// shadow props on iOS, `elevation` on Android. Tinted with colors.primary
// for the play button's soft violet glow.
const platformElevation = Platform.select({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  android: {
    elevation: 6,
  },
  default: {},
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accentLight,
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteButtonText: {
    fontSize: 22,
    color: colors.favorite,
  },
  scriptScroll: {
    flex: 1,
  },
  scriptContent: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scriptText: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  controlsContainer: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
  },
  playButtonText: {
    fontSize: 26,
    color: colors.onPrimary,
  },
});
