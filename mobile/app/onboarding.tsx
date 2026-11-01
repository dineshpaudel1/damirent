import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { ONBOARDING_KEY } from './index';

const { width: W } = Dimensions.get('window');

const slides = [
  {
    key: '1',
    icon: 'search-outline' as const,
    iconColor: Colors.primary,
    bgColor: Colors.primarySurface,
    accentColor: Colors.primary,
    title: 'Discover & Rent',
    desc: 'Browse hundreds of items near you — cameras, bikes, tools, and more. Find exactly what you need, when you need it.',
  },
  {
    key: '2',
    icon: 'wallet-outline' as const,
    iconColor: Colors.secondary,
    bgColor: Colors.secondarySurface,
    accentColor: Colors.secondary,
    title: 'List & Earn',
    desc: 'Turn idle items into income. List anything in minutes, set your own price, and start earning from your community.',
  },
  {
    key: '3',
    icon: 'shield-checkmark-outline' as const,
    iconColor: Colors.success,
    bgColor: Colors.successSurface,
    accentColor: Colors.success,
    title: 'Safe & Trusted',
    desc: 'Every user is identity-verified. Payments are secure. Rent and lend with complete confidence.',
  },
];

async function finish() {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  router.replace('/(auth)/login');
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const isLast = activeIndex === slides.length - 1;
  const activeSlide = slides[activeIndex];

  function handleNext() {
    if (isLast) {
      void finish();
    } else {
      const next = activeIndex + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={() => void finish()} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / W));
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Illustration */}
            <View style={[styles.illustrationWrap, { backgroundColor: item.bgColor }]}>
              {/* Decorative ring */}
              <View style={[styles.decorRing, { borderColor: item.iconColor + '22' }]} />
              {/* Icon circle */}
              <View style={[styles.iconCircle, { backgroundColor: item.iconColor }]}>
                <Ionicons name={item.icon} size={52} color={Colors.textInverse} />
              </View>
            </View>

            {/* Text */}
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Page dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && [styles.dotActive, { backgroundColor: activeSlide.accentColor }],
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={[styles.nextBtn, { backgroundColor: activeSlide.accentColor }, Shadow.md]}
          onPress={handleNext}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          <Ionicons
            name={isLast ? 'checkmark-circle-outline' : 'arrow-forward'}
            size={18}
            color={Colors.textInverse}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Skip ──────────────────────────────────────────────────
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },

  // ── Slide ─────────────────────────────────────────────────
  slide: {
    width: W,
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  illustrationWrap: {
    width: W * 0.68,
    aspectRatio: 1,
    borderRadius: W * 0.34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorRing: {
    position: 'absolute',
    width: W * 0.55,
    height: W * 0.55,
    borderRadius: W * 0.275,
    borderWidth: 2,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  slideDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.65,
  },

  // ── Bottom ────────────────────────────────────────────────
  bottom: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 26,
    borderRadius: 4,
  },
  nextBtn: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  nextBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textInverse,
  },
});
