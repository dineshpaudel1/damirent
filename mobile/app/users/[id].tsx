import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { productService } from '@/services/product.service';
import ProductCard from '@/components/ui/ProductCard';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

// ── Stat item — mirrors profile.tsx ──────────────────────────────────────────

function StatItem({
  value,
  label,
  icon,
  iconColor,
}: {
  value: string | number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color={iconColor ?? Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Verified badge ────────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <View style={styles.verifiedPill}>
      <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const {
    data: profile,
    isLoading: profileLoading,
    isRefetching: profileRefetching,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['publicProfile', id],
    queryFn: () => authService.getPublicProfile(id!),
    enabled: !!id,
  });

  const {
    data: listingsData,
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ['products', 'owner', id],
    queryFn: () => productService.listProducts({ owner: id, ordering: '-created_at', page_size: 20 }),
    enabled: !!id,
  });

  const isLoading = profileLoading;
  const isRefetching = profileRefetching;

  function handleRefresh() {
    void refetchProfile();
    void refetchListings();
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </View>
    );
  }

  const p = profile.profile;
  const isVerified = profile.is_verified && profile.identity_verified;
  const initial = (profile.full_name as string).charAt(0).toUpperCase();
  const ownerRating = p ? parseFloat(p.avg_owner_rating) : 0;
  const listings = listingsData?.results ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.full_name}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Hero card ──────────────────────────────────────── */}
        <View style={[styles.heroCard, Shadow.sm]}>
          {/* Avatar */}
          {p?.avatar ? (
            <Image source={{ uri: p.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}

          {/* Name + verified badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.full_name}</Text>
            {isVerified && <VerifiedBadge />}
          </View>

          {/* City */}
          {p?.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.metaText}>{p.city}</Text>
            </View>
          ) : null}

          {/* Bio */}
          {p?.bio ? (
            <Text style={styles.bio}>{p.bio}</Text>
          ) : null}

          {/* Stats row */}
          {p && (
            <View style={styles.statsRow}>
              <StatItem
                value={p.total_listings}
                label="Listings"
                icon="cube-outline"
                iconColor={Colors.primary}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={p.total_rentals}
                label="Rentals"
                icon="repeat-outline"
                iconColor={Colors.secondary}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={p.review_count}
                label="Reviews"
                icon="chatbubble-outline"
                iconColor={Colors.primary}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={ownerRating > 0 ? ownerRating.toFixed(1) : '—'}
                label="Owner ★"
                icon="star"
                iconColor="#F59E0B"
              />
            </View>
          )}
        </View>

        {/* ── Listings section ───────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active listings</Text>
          {listingsLoading && (
            <ActivityIndicator size="small" color={Colors.primary} />
          )}
        </View>

        {!listingsLoading && listings.length === 0 ? (
          <View style={[styles.emptyListings, Shadow.sm]}>
            <Ionicons name="cube-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyListingsText}>No active listings</Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ProductCard product={item} horizontal />}
            scrollEnabled={false}
            contentContainerStyle={styles.listingsList}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },

  // ── Loading / error ──────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },

  // ── Scroll content ───────────────────────────────────────
  content: {
    padding: Spacing.base,
    gap: Spacing.base,
  },

  // ── Hero card ────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: Spacing.xs,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.primary + '44',
    marginBottom: Spacing.xs,
  },
  avatarInitial: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  name: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.successSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  verifiedText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  bio: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.6,
    marginTop: Spacing.xs,
  },

  // ── Stats ────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: Colors.border,
  },

  // ── Listings section ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listingsList: {
    gap: 0,
  },
  emptyListings: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyListingsText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
});
