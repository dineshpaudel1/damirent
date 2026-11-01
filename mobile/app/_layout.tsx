import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { Colors } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

// ── Animated Splash ───────────────────────────────────────────────────────────

function AnimatedSplash({ ready }: { ready: boolean }) {
  const logoScale = React.useMemo(() => new Animated.Value(0.35), []);
  const logoOpacity = React.useMemo(() => new Animated.Value(0), []);
  const glowScale = React.useMemo(() => new Animated.Value(0.6), []);
  const glowOpacity = React.useMemo(() => new Animated.Value(0), []);
  const ring1Scale = React.useMemo(() => new Animated.Value(0.8), []);
  const ring1Opacity = React.useMemo(() => new Animated.Value(0), []);
  const ring2Scale = React.useMemo(() => new Animated.Value(0.8), []);
  const ring2Opacity = React.useMemo(() => new Animated.Value(0), []);
  const textOpacity = React.useMemo(() => new Animated.Value(0), []);
  const textY = React.useMemo(() => new Animated.Value(18), []);
  const dotOpacity = React.useMemo(() => new Animated.Value(0), []);
  const exitOpacity = React.useMemo(() => new Animated.Value(1), []);
  const [hidden, setHidden] = useState(false);

  // Entry animation — plays immediately on mount
  useEffect(() => {
    Animated.sequence([
      // Phase 1: logo + glow appear with spring
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 110,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: pulse rings burst out
      Animated.parallel([
        // Ring 1
        Animated.sequence([
          Animated.timing(ring1Opacity, { toValue: 0.55, duration: 120, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 2.2, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 0, duration: 650, useNativeDriver: true }),
          ]),
        ]),
        // Ring 2 (slightly delayed)
        Animated.sequence([
          Animated.delay(130),
          Animated.timing(ring2Opacity, { toValue: 0.38, duration: 120, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ring2Scale, { toValue: 2.9, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          ]),
        ]),
        // Tagline slides up
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(textY, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        // Loading dot pulses
        Animated.timing(dotOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Exit — triggered once fonts + auth are ready
  useEffect(() => {
    if (ready) {
      // Minimum visible time: wait a bit then fade
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 380,
        delay: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setHidden(true);
      });
    }
  }, [ready]);

  if (hidden) return null;

  return (
    <Animated.View style={[splashStyles.root, { opacity: exitOpacity }]}>
      {/* Neutral badge circle — neither brand color so logo text stays readable */}
      <Animated.View
        style={[
          splashStyles.badge,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {/* Pulse ring 1 — blue */}
      <Animated.View
        style={[
          splashStyles.ring,
          { borderColor: Colors.primary, opacity: ring1Opacity, transform: [{ scale: ring1Scale }] },
        ]}
      />

      {/* Pulse ring 2 — orange */}
      <Animated.View
        style={[
          splashStyles.ring,
          { borderColor: Colors.secondary, opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
        ]}
      />

      {/* Logo */}
      <Animated.Image
        source={require('@/assets/logo.png')}
        style={[splashStyles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />

      {/* Tagline */}
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }] }}>
        <Text style={splashStyles.tagline}>Nepal's peer-to-peer rental marketplace</Text>
      </Animated.View>

      {/* Two-tone brand accent — blue + orange */}
      <Animated.View style={[splashStyles.accentRow, { opacity: dotOpacity }]}>
        <View style={splashStyles.accentBlue} />
        <View style={splashStyles.accentOrange} />
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  // Neutral container — intentionally NOT a brand color so both blue and
  // orange logo elements remain fully readable on top of it.
  badge: {
    position: 'absolute',
    width: 268,
    height: 268,
    borderRadius: 134,
    backgroundColor: '#F0F3FC',  // cool silver-blue, distinct from #2B3990 and #F47B20
  },
  // Rings have no hardcoded borderColor — it is applied inline per ring
  ring: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
  },
  logo: {
    width: 218,
    height: 68,
  },
  tagline: {
    marginTop: 16,
    fontSize: 12.5,
    fontFamily: 'System',
    color: Colors.textTertiary,
    letterSpacing: 0.45,
    textAlign: 'center',
  },
  // Two-tone accent: one blue bar + one orange bar
  accentRow: {
    position: 'absolute',
    bottom: '13%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  accentBlue: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
  },
  accentOrange: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.secondary,
  },
});

// ── Root Layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  const appReady = fontsLoaded && !isLoading;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      {appReady && <Slot />}
      <AnimatedSplash ready={appReady} />
    </QueryClientProvider>
  );
}
