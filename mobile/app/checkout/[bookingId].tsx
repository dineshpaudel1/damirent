import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
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
import { productService } from '@/services/product.service';
import Button from '@/components/ui/Button';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatPrice, formatDate } from '@/utils/formatters';

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <Ionicons name={icon} size={15} color={Colors.primary} />
      <Text style={styles.cardHeaderText}>{title}</Text>
    </View>
  );
}

function PriceRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={bold ? styles.priceTotalLabel : styles.priceLabel}>{label}</Text>
      <Text style={bold ? styles.priceTotalValue : styles.priceValue}>{value}</Text>
    </View>
  );
}

function InfoBox({
  icon,
  text,
  type = 'info',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  type?: 'info' | 'warning' | 'success';
}) {
  const colors = {
    info: { bg: Colors.primarySurface, border: Colors.primary + '33', icon: Colors.primary, text: Colors.primary },
    warning: { bg: Colors.warningSurface, border: Colors.warning + '44', icon: Colors.warning, text: Colors.textSecondary },
    success: { bg: Colors.successSurface, border: Colors.success + '44', icon: Colors.success, text: Colors.textSecondary },
  }[type];

  return (
    <View style={[styles.infoBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Ionicons name={icon} size={16} color={colors.icon} style={{ marginTop: 1 }} />
      <Text style={[styles.infoBoxText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

// ── Header (shared across all states) ────────────────────────────────────────

function Header({ title, insetTop }: { title: string; insetTop: number }) {
  return (
    <View style={[styles.header, { paddingTop: insetTop + Spacing.md }]}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerRight} />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { bookingId, productId, startDate, endDate } = useLocalSearchParams<{
    bookingId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }>();

  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // 'new' sentinel: navigated from the date picker, booking not yet created
  const isNew = bookingId === 'new';
  const paymentOpened = useRef(false);
  const appState = useRef(AppState.currentState);

  const [bookingCreated, setBookingCreated] = useState<string | null>(
    isNew ? null : (bookingId ?? null),
  );

  // Refetch booking when user returns from Khalti browser tab
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        paymentOpened.current &&
        appState.current?.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['booking', bookingCreated] });
        paymentOpened.current = false;
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [bookingCreated, queryClient]);

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productService.getProduct(productId!),
    enabled: !!productId && isNew,
  });

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingCreated],
    queryFn: () => bookingService.getBooking(bookingCreated!),
    enabled: !!bookingCreated,
  });

  const createBooking = useMutation({
    mutationFn: () =>
      bookingService.createBooking({
        product: productId!,
        start_date: startDate!,
        end_date: endDate!,
      }),
    onSuccess: (b) => {
      setBookingCreated(b.id);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => {
      Alert.alert(
        'Booking failed',
        'This item may not be available for the selected dates. Go back and try different dates.',
      );
    },
  });

  const initiatePayment = useMutation({
    mutationFn: () => bookingService.initiatePayment({ booking: bookingCreated! }),
    onSuccess: async (data) => {
      const supported = await Linking.canOpenURL(data.payment_url);
      if (supported) {
        paymentOpened.current = true;
        await Linking.openURL(data.payment_url);
      } else {
        Alert.alert('Error', 'Unable to open payment page.');
      }
    },
    onError: () => {
      Alert.alert('Payment error', 'Could not initiate payment. Please try again.');
    },
  });

  // ── State 1: Confirm booking (new, product loaded) ─────────────────────────

  if (isNew && !bookingCreated && product && productId && startDate && endDate) {
    const days =
      Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    const rentalTotal = product.price_per_day * days;
    const platformFee = Math.round((rentalTotal * 8) / 100);
    const total = rentalTotal + product.security_deposit + platformFee;

    return (
      <View style={styles.container}>
        <Header title="Confirm booking" insetTop={insets.top} />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Total hero */}
          <View style={[styles.heroCard, Shadow.sm]}>
            <Text style={styles.heroLabel}>You'll be charged</Text>
            <Text style={styles.heroAmount}>{formatPrice(total)}</Text>
            <Text style={styles.heroSub}>after owner approval</Text>
          </View>

          {/* Item */}
          <View style={[styles.card, Shadow.sm]}>
            <SectionHeader icon="cube-outline" title="Item" />
            <Text style={styles.itemTitle}>{product.title}</Text>
            <View style={styles.datesRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={13} color={Colors.textTertiary} />
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
              </View>
              <View style={styles.durationChip}>
                <Text style={styles.durationText}>{days} day{days !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>

          {/* Price breakdown */}
          <View style={[styles.card, Shadow.sm]}>
            <SectionHeader icon="receipt-outline" title="Price breakdown" />
            <PriceRow
              label={`${formatPrice(product.price_per_day)} × ${days} day${days !== 1 ? 's' : ''}`}
              value={formatPrice(rentalTotal)}
            />
            <PriceRow label="Platform fee (8%)" value={formatPrice(platformFee)} />
            <PriceRow label="Security deposit" value={formatPrice(product.security_deposit)} />
            <View style={styles.priceDivider} />
            <PriceRow label="Total" value={formatPrice(total)} bold />
          </View>

          {/* Info notice */}
          <InfoBox
            icon="information-circle-outline"
            text="Your request will be sent to the owner. Once approved, you'll have 6 hours to complete payment."
          />

          <Button
            label="Send booking request"
            onPress={() => createBooking.mutate()}
            loading={createBooking.isPending}
            size="lg"
          />
        </ScrollView>
      </View>
    );
  }

  // ── State 2: Booking exists ────────────────────────────────────────────────

  if (booking) {
    const isPendingPayment = booking.status === 'approved';
    const isPendingApproval = booking.status === 'pending_approval';

    return (
      <View style={styles.container}>
        <Header
          title={isPendingPayment ? 'Complete payment' : 'Booking submitted'}
          insetTop={insets.top}
        />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Total hero */}
          <View style={[styles.heroCard, Shadow.sm]}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Booking total</Text>
                <Text style={styles.heroAmount}>{formatPrice(booking.total_charged)}</Text>
              </View>
              <BookingStatusBadge status={booking.status} />
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMeta}>
              <Ionicons name="cube-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.heroMetaText} numberOfLines={1}>{booking.product.title}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.heroMetaText}>
                {formatDate(booking.start_date)} → {formatDate(booking.end_date)}
                {'  ·  '}{booking.total_days} day{booking.total_days !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Price breakdown */}
          <View style={[styles.card, Shadow.sm]}>
            <SectionHeader icon="receipt-outline" title="Price breakdown" />
            <PriceRow
              label={`${formatPrice(booking.product.price_per_day)} × ${booking.total_days} day${booking.total_days !== 1 ? 's' : ''}`}
              value={formatPrice(booking.rental_total)}
            />
            <PriceRow label="Platform fee (8%)" value={formatPrice(booking.platform_fee)} />
            <PriceRow label="Security deposit" value={formatPrice(booking.security_deposit)} />
            <View style={styles.priceDivider} />
            <PriceRow label="Total charged" value={formatPrice(booking.total_charged)} bold />
          </View>

          {/* Pay with Khalti */}
          {isPendingPayment && (
            <>
              <View style={[styles.payCard, Shadow.sm]}>
                <View style={styles.payIconWrap}>
                  <Ionicons name="card-outline" size={28} color={Colors.primary} />
                </View>
                <Text style={styles.payTitle}>Pay with Khalti</Text>
                <Text style={styles.paySub}>
                  You'll be redirected to Khalti to complete your payment securely.
                </Text>
              </View>
              <Button
                label="Pay now"
                onPress={() => initiatePayment.mutate()}
                loading={initiatePayment.isPending}
                size="lg"
              />
            </>
          )}

          {/* Waiting for approval */}
          {isPendingApproval && (
            <InfoBox
              icon="time-outline"
              text="Waiting for the owner to approve your request (up to 24 hours). You'll be notified when they respond."
              type="warning"
            />
          )}

          {/* Confirmed / beyond payment */}
          {!isPendingPayment && !isPendingApproval && (
            <InfoBox
              icon="checkmark-circle-outline"
              text="Payment received. Your booking is confirmed — check the booking details for next steps."
              type="success"
            />
          )}

          <Button
            label="View booking details"
            variant="outline"
            onPress={() => router.replace(`/booking/${booking.id}`)}
            size="lg"
          />
        </ScrollView>
      </View>
    );
  }

  // ── State 3: Loading ───────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Header title="Checkout" insetTop={insets.top} />
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
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
    paddingBottom: Spacing.md,
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

  // ── Loading ──────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll content ───────────────────────────────────────
  content: {
    padding: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },

  // ── Hero card ────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  heroTopRow: {
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
  heroSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Generic card ─────────────────────────────────────────
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
  cardHeaderText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Item card ────────────────────────────────────────────
  itemTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBox: { gap: 2 },
  dateLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  dateValue: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  durationChip: {
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

  // ── Price breakdown ──────────────────────────────────────
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

  // ── Pay card ─────────────────────────────────────────────
  payCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '22',
  },
  payIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  payTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  paySub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.6,
  },

  // ── Info box ─────────────────────────────────────────────
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  infoBoxText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});
