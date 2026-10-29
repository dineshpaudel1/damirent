import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '@/services/booking.service';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatRelativeTime } from '@/utils/formatters';
import type { Review } from '@/types';

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const initial = review.reviewer.full_name.charAt(0).toUpperCase();
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <View style={[styles.card, Shadow.sm]}>
      {/* Header row: avatar + name + role + date */}
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <View style={styles.reviewerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.reviewerName}>{review.reviewer.full_name}</Text>
            {review.reviewer.is_verified && (
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {review.reviewer_role === 'owner' ? 'Owner' : 'Renter'}
              </Text>
            </View>
            <Text style={styles.date}>{formatRelativeTime(review.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* Stars */}
      <View style={styles.starsRow}>
        {stars.map((s) => (
          <Ionicons
            key={s}
            name={s <= review.rating ? 'star' : 'star-outline'}
            size={14}
            color={s <= review.rating ? '#F59E0B' : Colors.border}
          />
        ))}
        <Text style={styles.ratingNum}>{review.rating.toFixed(1)}</Text>
      </View>

      {/* Comment */}
      <Text style={styles.comment}>{review.comment}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReviewListScreen() {
  const { productId, productTitle } = useLocalSearchParams<{
    productId: string;
    productTitle?: string;
  }>();
  const insets = useSafeAreaInsets();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => bookingService.getReviewsForProduct(productId),
    enabled: !!productId,
  });

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Reviews</Text>
          {productTitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>{productTitle}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* ── Content ─────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing['2xl'] },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-outline" size={32} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptySub}>
                Be the first to share your experience with this item.
              </Text>
            </View>
          }
          ListHeaderComponent={
            reviews.length > 0 ? (
              <Text style={styles.countLabel}>
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </Text>
            ) : undefined
          }
        />
      )}
    </View>
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
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMid: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    maxWidth: 180,
  },
  headerRight: { width: 36 },

  // ── Loading ──────────────────────────────────────────────
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── List ─────────────────────────────────────────────────
  list: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  countLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },

  // ── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
  reviewerInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewerName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  roleBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    color: Colors.primary,
  },
  date: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },

  // ── Stars ────────────────────────────────────────────────
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingNum: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
  },

  // ── Comment ──────────────────────────────────────────────
  comment: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * 1.6,
  },

  // ── Empty ────────────────────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});
