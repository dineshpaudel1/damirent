import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '@/services/booking.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
const RATING_COLORS = [
  '',
  Colors.error,
  Colors.warning,
  '#F59E0B',
  Colors.primary,
  Colors.success,
];

export default function CreateReviewScreen() {
  const params = useLocalSearchParams<{ bookingId: string }>();
  // useLocalSearchParams can return string | string[] — always take the scalar value
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;

  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      bookingService.createReview({ booking: bookingId, rating, comment: comment.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      router.back();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<ApiError>;
      const data = axiosErr.response?.data;

      if (data?.field_errors) {
        // Flatten first field error found
        const firstField = Object.values(data.field_errors)[0];
        setError(firstField?.[0] ?? 'Validation error. Please check your input.');
      } else if (data?.error) {
        setError(data.error);
      } else if (!axiosErr.response) {
        setError('Cannot reach the server. Check your connection.');
      } else {
        setError('Failed to submit review. Please try again.');
      }
    },
  });

  function handleSubmit() {
    if (!bookingId) { setError('Booking reference is missing. Please go back and try again.'); return; }
    if (rating === 0) { setError('Please select a rating'); return; }
    if (!comment.trim()) { setError('Please write a short review'); return; }
    setError('');
    submit.mutate();
  }

  const activeColor = rating > 0 ? RATING_COLORS[rating] : Colors.textTertiary;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Leave a review</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Icon ────────────────────────────────────────── */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="star" size={32} color="#F59E0B" />
          </View>
        </View>

        {/* ── Card ────────────────────────────────────────── */}
        <View style={[styles.card, Shadow.md]}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>How was your experience?</Text>
            <Text style={styles.subtitle}>
              Your honest feedback helps the community
            </Text>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Stars */}
          <View style={styles.starsSection}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => { setRating(star); setError(''); }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= rating ? '#F59E0B' : Colors.border}
                  />
                </Pressable>
              ))}
            </View>
            {rating > 0 ? (
              <Text style={[styles.ratingLabel, { color: activeColor }]}>
                {RATING_LABELS[rating]}
              </Text>
            ) : (
              <Text style={styles.ratingPlaceholder}>Tap to rate</Text>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Comment field */}
          <Input
            label="Your review"
            placeholder="Share what went well (or didn't)…"
            value={comment}
            onChangeText={(v) => { setError(''); setComment(v); }}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={{ minHeight: 120 }}
          />

          <Button
            label="Submit review"
            onPress={handleSubmit}
            loading={submit.isPending}
            disabled={rating === 0}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  headerRight: { width: 36 },

  // ── Scroll ──────────────────────────────────────────────
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
    justifyContent: 'center',
  },

  // ── Icon ────────────────────────────────────────────────
  iconWrap: { alignItems: 'center' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B33',
  },

  // ── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  cardHead: { gap: Spacing.sm },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.base * 1.5,
  },

  // ── Error ────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.error + '33',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },

  // ── Stars ────────────────────────────────────────────────
  starsSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  ratingLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
  },
  ratingPlaceholder: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
});
