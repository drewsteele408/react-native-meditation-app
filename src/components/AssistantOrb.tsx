import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

// The native driver isn't available on web; Animated falls back to JS there.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Respect the OS "reduce motion" setting: the orb renders as a still image.
function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  return reduceMotion;
}

// 0 → 1 repeating forever at a constant rate. Every motion is built from
// this single native-driven loop so it runs entirely on the UI thread: no JS
// handoffs between iterations, so a busy JS thread can't cause stutters or
// jumps. Back-and-forth motions come from `wave` below, not from reversing.
function useLoop(duration: number, paused: boolean) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.setValue(0);
    if (paused) return;
    const animation = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, paused, value]);

  return value;
}

const spin = (value: Animated.Value, direction: 1 | -1 = 1, startDeg = 0) =>
  value.interpolate({
    inputRange: [0, 1],
    outputRange: [`${startDeg}deg`, `${startDeg + 360 * direction}deg`],
  });

// Smooth from → to → from over one loop, shaped like a cosine wave so it
// eases at both ends and the end of one cycle meets the start of the next
// seamlessly. Sampled because interpolate() is piecewise-linear.
const WAVE_STEPS = 24;
const WAVE_INPUT = Array.from({ length: WAVE_STEPS + 1 }, (_, i) => i / WAVE_STEPS);
const WAVE_SHAPE = WAVE_INPUT.map((t) => (1 - Math.cos(2 * Math.PI * t)) / 2);

const wave = (value: Animated.Value, from: number, to: number) =>
  value.interpolate({
    inputRange: WAVE_INPUT,
    outputRange: WAVE_SHAPE.map((k) => from + (to - from) * k),
  });

type BlobProps = {
  /** Size of the whole orb; the blob orbits within this square. */
  stage: number;
  /** Diameter of the blob itself. */
  size: number;
  color: string;
  /** Distance of the blob's center from the orb's center. */
  orbitRadius: number;
  /** Where on the orbit the blob starts, in degrees. */
  startAngle: number;
  orbitMs: number;
  wobbleMs: number;
  spinMs: number;
  direction?: 1 | -1;
  opacity?: number;
  paused: boolean;
};

// One liquid blob. Three nested transforms combine into an organic motion:
// the outer layer drifts it around the orbit, the middle squashes/stretches
// it like a droplet, and the inner layer spins its uneven corner radii so
// the silhouette keeps changing. Only transforms/opacity are animated so
// everything stays on the native driver.
function LiquidBlob({
  stage,
  size,
  color,
  orbitRadius,
  startAngle,
  orbitMs,
  wobbleMs,
  spinMs,
  direction = 1,
  opacity = 0.7,
  paused,
}: BlobProps) {
  const orbit = useLoop(orbitMs, paused);
  const wobble = useLoop(wobbleMs * 2, paused);
  const selfSpin = useLoop(spinMs, paused);

  // Built once per blob: recreating interpolations on re-render reattaches
  // the native animation graph, which can make the blob snap.
  const motion = useMemo(
    () => ({
      orbitRotate: spin(orbit, direction, startAngle),
      scaleX: wave(wobble, 0.86, 1.14),
      scaleY: wave(wobble, 1.12, 0.88),
      selfRotate: spin(selfSpin, (direction * -1) as 1 | -1),
    }),
    [orbit, wobble, selfSpin, direction, startAngle],
  );

  return (
    <Animated.View
      style={[
        styles.layer,
        { width: stage, height: stage, transform: [{ rotate: motion.orbitRotate }] },
      ]}
    >
      <Animated.View
        style={[
          styles.layer,
          {
            width: size,
            height: size,
            top: stage / 2 - orbitRadius - size / 2,
            left: (stage - size) / 2,
            transform: [{ scaleX: motion.scaleX }, { scaleY: motion.scaleY }],
          },
        ]}
      >
        <Animated.View
          style={[
            {
              width: size,
              height: size,
              backgroundColor: color,
              opacity,
              // Uneven corners make a lopsided, drop-like silhouette.
              borderTopLeftRadius: size * 0.5,
              borderTopRightRadius: size * 0.36,
              borderBottomRightRadius: size * 0.5,
              borderBottomLeftRadius: size * 0.3,
              boxShadow: `0 0 ${Math.round(size * 0.18)}px ${color}`,
              transform: [{ rotate: motion.selfRotate }],
            },
          ]}
        >
          {/* Glossy highlight so the surface reads as wet */}
          <View
            style={[
              styles.highlight,
              {
                width: size * 0.32,
                height: size * 0.16,
                borderRadius: size,
                top: size * 0.16,
                left: size * 0.18,
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

type Props = {
  size: number;
};

// Decorative liquid orb shown behind the home-screen greeting so the app
// feels like an assistant that's awake and ready. Purely visual: it's hidden
// from screen readers and lets touches pass through.
// Memoized so typing on the home screen doesn't re-render the orb.
export const AssistantOrb = memo(function AssistantOrb({ size }: Props) {
  const paused = useReduceMotion();

  const breath = useLoop(6400, paused);
  const breathScale = useMemo(() => wave(breath, 0.94, 1.06), [breath]);
  const glowOpacity = useMemo(() => wave(breath, 0.1, 0.22), [breath]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, { width: size, height: size }]}
    >
      {/* Soft breathing glow behind everything */}
      <Animated.View
        style={[
          styles.layer,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: size,
            backgroundColor: colors.orbCyan,
            opacity: glowOpacity,
            transform: [{ scale: breathScale }],
          },
        ]}
      />

      <LiquidBlob
        stage={size}
        size={size * 0.56}
        color={colors.orbBlue}
        orbitRadius={size * 0.13}
        startAngle={200}
        orbitMs={16000}
        wobbleMs={2600}
        spinMs={9000}
        direction={-1}
        opacity={0.75}
        paused={paused}
      />
      <LiquidBlob
        stage={size}
        size={size * 0.5}
        color={colors.orbOrange}
        orbitRadius={size * 0.16}
        startAngle={-40}
        orbitMs={12000}
        wobbleMs={3100}
        spinMs={7000}
        opacity={0.6}
        paused={paused}
      />
      <LiquidBlob
        stage={size}
        size={size * 0.46}
        color={colors.orbCyan}
        orbitRadius={size * 0.15}
        startAngle={90}
        orbitMs={10000}
        wobbleMs={2200}
        spinMs={8000}
        opacity={0.6}
        paused={paused}
      />

      {/* Small droplets flung off the edge of the pool */}
      <LiquidBlob
        stage={size}
        size={size * 0.09}
        color={colors.orbYellow}
        orbitRadius={size * 0.42}
        startAngle={20}
        orbitMs={13000}
        wobbleMs={1400}
        spinMs={3000}
        opacity={0.9}
        paused={paused}
      />
      <LiquidBlob
        stage={size}
        size={size * 0.06}
        color={colors.orbYellow}
        orbitRadius={size * 0.44}
        startAngle={-5}
        orbitMs={13000}
        wobbleMs={1100}
        spinMs={2600}
        opacity={0.9}
        paused={paused}
      />

      {/* Darker core keeps the greeting legible over the liquid */}
      <View
        style={[
          styles.layer,
          styles.core,
          {
            width: size * 0.5,
            height: size * 0.3,
            borderRadius: size,
            boxShadow: `0 0 ${Math.round(size * 0.15)}px ${Math.round(size * 0.08)}px ${colors.background}`,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    opacity: 0.28,
    transform: [{ rotate: '-30deg' }],
  },
  core: {
    backgroundColor: colors.background,
    opacity: 0.45,
  },
});
