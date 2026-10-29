import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatPricePerDay, formatRating } from '@/utils/formatters';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  horizontal?: boolean;
}

const CONDITION_COLOR: Record<string, string> = {
  excellent: Colors.success,
  good: Colors.primary,
  fair: Colors.warning,
};

export default function ProductCard({ product, horizontal = false }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.is_primary) ?? product.images[0];
  const ratingValue = parseFloat(product.avg_rating);
  const hasRating = !isNaN(ratingValue) && ratingValue > 0;
  const conditionColor = CONDITION_COLOR[product.condition] ?? Colors.textTertiary;

  function handlePress() {
    router.push(`/product/${product.id}`);
  }

  // ── Horizontal card — full-width search result row ────────────────────────

  if (horizontal) {
    return (
      <Pressable style={[styles.hCard, Shadow.sm]} onPress={handlePress}>
        {/* Image */}
        <View style={styles.hImageWrap}>
          <Image
            source={{ uri: primaryImage?.image ?? 'https://placehold.co/96x96' }}
            style={styles.hImage}
            resizeMode="cover"
          />
          {!product.is_available && (
            <View style={styles.unavailableOverlay}>
              <Text style={styles.unavailableOverlayText}>Unavailable</Text>
            </View>
          )}
        </View>

        {/* Body — 3 tight rows */}
        <View style={styles.hBody}>
          {/* Row 1: location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
            <Text style={styles.location} numberOfLines={1}>{product.pickup_location}</Text>
          </View>

          {/* Row 2: title */}
          <Text style={styles.hTitle} numberOfLines={1}>{product.title}</Text>

          {/* Row 3: price · condition · rating */}
          <View style={styles.hFooter}>
            <Text style={styles.hPrice}>{formatPricePerDay(product.price_per_day)}</Text>
            <View style={styles.hFooterRight}>
              <View style={[styles.conditionChip, { borderColor: conditionColor + '55' }]}>
                <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
                <Text style={[styles.conditionLabel, { color: conditionColor }]}>
                  {product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
                </Text>
              </View>
              {hasRating ? (
                <View style={styles.ratingChip}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.ratingText}>{formatRating(product.avg_rating)}</Text>
                </View>
              ) : (
                <View style={styles.newChip}>
                  <Text style={styles.newChipText}>New</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Chevron */}
        <View style={styles.hChevron}>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </View>
      </Pressable>
    );
  }

  // ── Vertical card — home screen horizontal scroll ─────────────────────────

  return (
    <Pressable style={[styles.vCard, Shadow.sm]} onPress={handlePress}>
      {/* Image */}
      <View style={styles.vImageWrap}>
        <Image
          source={{ uri: primaryImage?.image ?? 'https://placehold.co/300x200' }}
          style={styles.vImage}
          resizeMode="cover"
        />
        {!product.is_available && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableOverlayText}>Unavailable</Text>
          </View>
        )}
        {hasRating && (
          <View style={styles.vRatingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.vRatingText}>{formatRating(product.avg_rating)}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.vBody}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.location} numberOfLines={1}>{product.pickup_location}</Text>
        </View>
        <Text style={styles.vTitle} numberOfLines={2}>{product.title}</Text>
        <View style={styles.vFooter}>
          <Text style={styles.vPrice}>{formatPricePerDay(product.price_per_day)}</Text>
          <View style={[styles.conditionChip, { borderColor: conditionColor + '55' }]}>
            <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
            <Text style={[styles.conditionLabel, { color: conditionColor }]}>
              {product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ── Shared ──────────────────────────────────────────────
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  conditionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  conditionLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  ratingText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
    color: '#92400E',
  },
  newChip: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  newChipText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    color: Colors.primary,
  },
  unavailableOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableOverlayText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // ── Horizontal card ──────────────────────────────────────
  hCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hImageWrap: {
    width: 96,
    height: 96,
    flexShrink: 0,
    position: 'relative',
  },
  hImage: {
    width: 96,
    height: 96,
  },
  hBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 5,
  },
  hTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.sm * 1.3,
  },
  hFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  hFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hPrice: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  hChevron: {
    paddingRight: Spacing.sm,
  },

  // ── Vertical card ────────────────────────────────────────
  vCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    width: 210,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vImageWrap: {
    position: 'relative',
  },
  vImage: {
    width: '100%',
    height: 148,
  },
  vRatingBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.52)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  vRatingText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
    color: '#fff',
  },
  vBody: {
    padding: Spacing.md,
    gap: 6,
  },
  vTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.base * 1.35,
  },
  vFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  vPrice: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
});
