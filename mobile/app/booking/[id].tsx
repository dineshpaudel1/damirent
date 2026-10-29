import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '@/services/booking.service';
import { useAuthStore } from '@/store/auth.store';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatDate, formatPrice } from '@/utils/formatters';
import type { BookingStatus } from '@/types';

// ── Status timeline ───────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
];

function statusToStep(status: BookingStatus): number {
  switch (status) {
    case 'pending_approval': return 0;
    case 'approved':
    case 'payment_pending': return 1;
    case 'confirmed': return 2;
    case 'active': return 3;
    case 'completed': return 4;
    default: return -1; // cancelled / expired / disputed
  }
}

function isTerminated(status: BookingStatus) {
  return ['cancelled_by_renter', 'cancelled_by_owner', 'expired', 'disputed'].includes(status);
}

function StatusTimeline({ status }: { status: BookingStatus }) {
  const currentStep = statusToStep(status);
  const terminated = isTerminated(status);

  if (terminated) {
    return (
      <View style={tl.terminatedWrap}>
        <Ionicons name="close-circle-outline" size={20} color={Colors.statusCancelled} />
        <Text style={tl.terminatedText}>
          {status === 'expired' ? 'Booking expired' : status === 'disputed' ? 'Under dispute' : 'Booking cancelled'}
        </Text>
      </View>
    );
  }

  return (
    <View style={tl.wrap}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = currentStep > i;
        const active = currentStep === i;
        return (
          <React.Fragment key={step.key}>
            <View style={tl.step}>
              <View style={[tl.dot, done && tl.dotDone, active && tl.dotActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={10} color="#fff" />
                ) : (
                  <View style={[tl.dotInner, active && tl.dotInnerActive]} />
                )}
              </View>
              <Text style={[tl.stepLabel, (done || active) && tl.stepLabelActive]}>
                {step.label}
              </Text>
            </View>
            {i < TIMELINE_STEPS.length - 1 && (
              <View style={[tl.line, done && tl.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
  },
  step: {
    alignItems: 'center',
    gap: 5,
    flex: 0,
    minWidth: 48,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotInnerActive: {
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginTop: 10,
  },
  lineDone: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 9,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  stepLabelActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  terminatedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.statusCancelledSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
  },
  terminatedText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.statusCancelled,
  },
});

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Price row ─────────────────────────────────────────────────────────────────

function PriceRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={bold ? styles.priceTotalLabel : styles.priceLabel}>{label}</Text>
      <Text style={bold ? styles.priceTotalValue : styles.priceValue}>{value}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingService.getBooking(id),
    enabled: !!id,
  });

  const { data: productReviews = [] } = useQuery({
    queryKey: ['reviews', booking?.product.id],
    queryFn: () => bookingService.getReviewsForProduct(booking!.product.id),
    enabled: !!booking && booking.status === 'completed',
  });

  const approve = useMutation({
    mutationFn: () => bookingService.approveBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  const reject = useMutation({
    mutationFn: () => bookingService.rejectBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  const cancel = useMutation({
    mutationFn: () => bookingService.cancelBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  const activate = useMutation({
    mutationFn: () => bookingService.activateBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  const confirmReturn = useMutation({
    mutationFn: () => bookingService.confirmReturn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  function handleCancel() {
    Alert.alert('Cancel booking', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, cancel', style: 'destructive', onPress: () => cancel.mutate() },
    ]);
  }

  // ── Loading ──────────────────────────────────────────────
  if (isLoading || !booking) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Booking details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const isOwner = booking.product.owner.id === user?.id;
  const isRenter = booking.renter.id === user?.id;
  const otherParty = isOwner ? booking.renter : booking.product.owner;
  const myReview = productReviews.find(
    (r) => r.booking === id && r.reviewer.id === user?.id,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Sticky header ─────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero: amount + status ──────────────────────── */}
        <View style={[styles.heroCard, Shadow.sm]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Total charged</Text>
              <Text style={styles.heroAmount}>{formatPrice(booking.total_charged)}</Text>
            </View>
            <BookingStatusBadge status={booking.status} />
          </View>
          <View style={styles.heroDivider} />
          <StatusTimeline status={booking.status} />
        </View>

        {/* ── Item ──────────────────────────────────────── */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cube-outline" size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>Item</Text>
          </View>
          <Text style={styles.itemTitle}>{booking.product.title}</Text>
          <View style={styles.datesRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateBoxLabel}>From</Text>
              <Text style={styles.dateBoxValue}>{formatDate(booking.start_date)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
            <View style={styles.dateBox}>
              <Text style={styles.dateBoxLabel}>To</Text>
              <Text style={styles.dateBoxValue}>{formatDate(booking.end_date)}</Text>
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {booking.total_days} day{booking.total_days !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.viewProductBtn}
            onPress={() => router.push(`/product/${booking.product.id}`)}
          >
            <Text style={styles.viewProductText}>View listing</Text>
            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
          </Pressable>
        </View>

        {/* ── People ────────────────────────────────────── */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>{isOwner ? 'Renter' : 'Owner'}</Text>
          </View>
          <View style={styles.personRow}>
            <View style={styles.personAvatar}>
              <Text style={styles.personInitial}>
                {otherParty.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{otherParty.full_name}</Text>
              {otherParty.is_verified && (
                <View style={styles.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Price breakdown ───────────────────────────── */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>Price breakdown</Text>
          </View>
          <PriceRow
            label={`${formatPrice(booking.product.price_per_day)} × ${booking.total_days} day${booking.total_days !== 1 ? 's' : ''}`}
            value={formatPrice(booking.rental_total)}
          />
          <PriceRow label="Platform fee (8%)" value={formatPrice(booking.platform_fee)} />
          <PriceRow label="Security deposit" value={formatPrice(booking.security_deposit)} />
          <View style={styles.priceDivider} />
          <PriceRow label="Total charged" value={formatPrice(booking.total_charged)} bold />
        </View>

        {/* ── Pickup location ───────────────────────────── */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>Pickup location</Text>
          </View>
          <Text style={styles.locationText}>{booking.product.pickup_location}</Text>
        </View>

        {/* ── Messages ──────────────────────────────────── */}
        {(booking.message || booking.owner_note) && (
          <View style={[styles.card, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Messages</Text>
            </View>
            {booking.message ? (
              <View style={styles.messageBlock}>
                <Text style={styles.messageFrom}>From renter</Text>
                <Text style={styles.messageText}>{booking.message}</Text>
              </View>
            ) : null}
            {booking.owner_note ? (
              <View style={styles.messageBlock}>
                <Text style={styles.messageFrom}>From owner</Text>
                <Text style={styles.messageText}>{booking.owner_note}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Actions ───────────────────────────────────── */}
        <View style={styles.actions}>
          {/* Owner: approve or decline pending booking */}
          {isOwner && booking.status === 'pending_approval' && (
            <>
              <Button
                label="Approve booking"
                onPress={() => approve.mutate()}
                loading={approve.isPending}
                size="lg"
              />
              <Button
                label="Decline"
                variant="danger"
                onPress={() => reject.mutate()}
                loading={reject.isPending}
                size="lg"
              />
            </>
          )}

          {/* Renter: go to payment */}
          {isRenter && booking.status === 'approved' && (
            <Button
              label="Pay with Khalti"
              onPress={() => router.push(`/checkout/${booking.id}`)}
              size="lg"
            />
          )}

          {/* Owner: confirm item handed over */}
          {isOwner && booking.status === 'confirmed' && (
            <Button
              label="Confirm item handed over"
              onPress={() => activate.mutate()}
              loading={activate.isPending}
              size="lg"
            />
          )}

          {/* Owner: confirm item returned */}
          {isOwner && booking.status === 'active' && (
            <Button
              label="Confirm item returned"
              onPress={() => confirmReturn.mutate()}
              loading={confirmReturn.isPending}
              size="lg"
            />
          )}

          {/* Renter: cancel */}
          {isRenter &&
            ['pending_approval', 'approved', 'confirmed'].includes(booking.status) && (
              <Button
                label="Cancel booking"
                variant="outline"
                onPress={handleCancel}
                loading={cancel.isPending}
                size="lg"
              />
            )}

        </View>

        {/* ── Review card ───────────────────────────────── */}
        {booking.status === 'completed' && (
          myReview ? (
            <View style={[styles.card, Shadow.sm]}>
              <View style={styles.cardHeader}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.cardTitle}>Your review</Text>
              </View>
              <View style={styles.reviewedStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= myReview.rating ? 'star' : 'star-outline'}
                    size={20}
                    color={s <= myReview.rating ? '#F59E0B' : Colors.border}
                  />
                ))}
                <Text style={styles.reviewedRatingNum}>{myReview.rating}.0</Text>
              </View>
              <Text style={styles.reviewedComment}>{myReview.comment}</Text>
            </View>
          ) : (
            <View style={[styles.card, Shadow.sm]}>
              <View style={styles.reviewPromptRow}>
                <View style={styles.reviewCheckCircle}>
                  <Ionicons name="checkmark-circle" size={26} color={Colors.success} />
                </View>
                <View style={styles.reviewPromptText}>
                  <Text style={styles.reviewPromptTitle}>Booking completed!</Text>
                  <Text style={styles.reviewPromptSub}>
                    {isRenter
                      ? 'How was the item? Your feedback helps the community.'
                      : 'How was the renter? Leave them a review.'}
                  </Text>
                </View>
              </View>
              <Button
                label="Leave a review"
                onPress={() =>
                  router.push({ pathname: '/review/create', params: { bookingId: id } })
                }
                size="lg"
              />
            </View>
          )
        )}

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  headerRight: { width: 36 },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },

  // ── Hero card ───────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  heroAmount: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.textPrimary,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Generic card ────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Item card ───────────────────────────────────────────
  itemTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  dateBox: {
    gap: 2,
  },
  dateBoxLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  dateBoxValue: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  durationBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  durationText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  viewProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingTop: Spacing.xs,
  },
  viewProductText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Person card ─────────────────────────────────────────
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '33',
  },
  personInitial: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  personInfo: {
    flex: 1,
    gap: 3,
  },
  personName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
  },

  // ── Price breakdown ─────────────────────────────────────
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  priceTotalLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  priceTotalValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },

  // ── Location ────────────────────────────────────────────
  locationText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.base * 1.5,
  },

  // ── Messages ────────────────────────────────────────────
  messageBlock: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  messageFrom: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.sm * 1.6,
  },

  // ── Info row (generic) ──────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },

  // ── Actions ─────────────────────────────────────────────
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // ── Review card ─────────────────────────────────────────
  reviewPromptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  reviewCheckCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewPromptText: {
    flex: 1,
    gap: 3,
  },
  reviewPromptTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  reviewPromptSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  reviewedStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reviewedRatingNum: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  reviewedComment: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});
