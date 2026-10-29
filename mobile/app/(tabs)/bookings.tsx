import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '@/services/booking.service';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatDate, formatPrice } from '@/utils/formatters';
import type { Booking, BookingStatus } from '@/types';

type Role = 'renter' | 'owner';

// ── Status bar colour ─────────────────────────────────────────────────────────

function statusBarColor(status: BookingStatus): string {
  switch (status) {
    case 'pending_approval':
    case 'approved':
    case 'payment_pending':
      return Colors.warning;
    case 'confirmed':
    case 'active':
      return Colors.primary;
    case 'completed':
      return Colors.success;
    case 'cancelled_by_renter':
    case 'cancelled_by_owner':
    case 'expired':
      return Colors.error;
    case 'disputed':
      return Colors.secondary;
    default:
      return Colors.border;
  }
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ booking, role }: { booking: Booking; role: Role }) {
  const other = role === 'renter' ? booking.product.owner : booking.renter;
  const initial = other.full_name.charAt(0).toUpperCase();
  const barColor = statusBarColor(booking.status);

  return (
    <Pressable
      style={[styles.card, Shadow.sm]}
      onPress={() => router.push(`/booking/${booking.id}`)}
    >
      {/* Left status bar */}
      <View style={[styles.statusBar, { backgroundColor: barColor }]} />

      <View style={styles.cardInner}>
        {/* Title + badge */}
        <View style={styles.cardTop}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {booking.product.title}
          </Text>
          <BookingStatusBadge status={booking.status} />
        </View>

        {/* Date range */}
        <View style={styles.datesRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.dateText}>{formatDate(booking.start_date)}</Text>
          <Ionicons name="arrow-forward" size={11} color={Colors.textTertiary} />
          <Text style={styles.dateText}>{formatDate(booking.end_date)}</Text>
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>
              {booking.total_days} day{booking.total_days !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.sep} />

        {/* Footer: party + price + chevron */}
        <View style={styles.cardFooter}>
          <View style={styles.partyRow}>
            <View style={styles.partyAvatar}>
              <Text style={styles.partyInitial}>{initial}</Text>
            </View>
            <View style={styles.partyInfo}>
              <Text style={styles.partyLabel}>
                {role === 'renter' ? 'Owner' : 'Renter'}
              </Text>
              <Text style={styles.partyName} numberOfLines={1}>
                {other.full_name}
              </Text>
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(booking.total_charged)}</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const [role, setRole] = useState<Role>('renter');
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bookings', role],
    queryFn: () => bookingService.listMyBookings(role),
  });

  const bookings: Booking[] = data?.results ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>

        {/* Segmented control */}
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segment, role === 'renter' && styles.segmentActive]}
            onPress={() => setRole('renter')}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={role === 'renter' ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.segmentLabel, role === 'renter' && styles.segmentLabelActive]}>
              As Renter
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, role === 'owner' && styles.segmentActive]}
            onPress={() => setRole('owner')}
          >
            <Ionicons
              name="key-outline"
              size={13}
              color={role === 'owner' ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.segmentLabel, role === 'owner' && styles.segmentLabelActive]}>
              As Owner
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── List ────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} role={role} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing['3xl'] },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { void refetch(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={role === 'renter' ? 'bag-outline' : 'storefront-outline'}
                  size={36}
                  color={Colors.textTertiary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {role === 'renter' ? 'No rentals yet' : 'No bookings to manage'}
              </Text>
              <Text style={styles.emptySub}>
                {role === 'renter'
                  ? 'Browse the marketplace and make your first rental.'
                  : 'List an item and start receiving booking requests.'}
              </Text>
              <Pressable
                style={styles.emptyAction}
                onPress={() =>
                  router.push(role === 'renter' ? '/(tabs)/search' : '/listing/create')
                }
              >
                <Text style={styles.emptyActionText}>
                  {role === 'renter' ? 'Browse items' : 'List an item'}
                </Text>
              </Pressable>
            </View>
          }
        />
      )}
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
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },

  // ── Segmented control ────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  segmentLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  segmentLabelActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },

  // ── List ─────────────────────────────────────────────────
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  // ── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statusBar: {
    width: 4,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },

  // ── Card top ─────────────────────────────────────────────
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  productTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },

  // ── Dates ────────────────────────────────────────────────
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  dateText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  durationPill: {
    marginLeft: 2,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  durationText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },

  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Footer ───────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  partyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  partyInitial: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  partyInfo: {
    flex: 1,
    gap: 1,
  },
  partyLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  partyName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  price: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },

  // ── Loading ──────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty ────────────────────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  emptyAction: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  emptyActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: '#fff',
  },
});
