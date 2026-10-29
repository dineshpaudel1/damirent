import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/product.service';
import { bookingService } from '@/services/booking.service';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatPricePerDay, formatPrice, formatDate, formatRelativeTime } from '@/utils/formatters';
import type { AvailabilityBlock, Review } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 300;
const DAY_SIZE = Math.floor((SCREEN_WIDTH - Spacing.base * 2 - 32) / 7);
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000,
  );
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return grid;
}

function isBlocked(dateStr: string, blocks: AvailabilityBlock[]): boolean {
  return blocks.some((b) => dateStr >= b.start_date && dateStr < b.end_date);
}

function isPast(dateStr: string): boolean {
  return dateStr < toISO(new Date());
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: string; count: number }) {
  const num = parseFloat(rating);
  const hasRating = !isNaN(num) && num > 0;
  const full = hasRating ? Math.floor(num) : 0;

  return (
    <View style={starSt.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? 'star' : 'star-outline'}
          size={15}
          color={i <= full ? '#F59E0B' : Colors.border}
        />
      ))}
      {hasRating ? (
        <>
          <Text style={starSt.val}>{num.toFixed(1)}</Text>
          <Text style={starSt.cnt}>({count} {count === 1 ? 'review' : 'reviews'})</Text>
        </>
      ) : (
        <Text style={starSt.none}>No reviews yet</Text>
      )}
    </View>
  );
}

const starSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  val: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginLeft: 2 },
  cnt: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  none: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textTertiary, marginLeft: 4 },
});

// ── Review item ───────────────────────────────────────────────────────────────

function ReviewItem({ review }: { review: Review }) {
  const initial = review.reviewer.full_name.charAt(0).toUpperCase();
  return (
    <View style={rv.item}>
      <View style={rv.header}>
        <View style={rv.avatar}>
          <Text style={rv.initial}>{initial}</Text>
        </View>
        <View style={rv.info}>
          <View style={rv.nameRow}>
            <Text style={rv.name}>{review.reviewer.full_name}</Text>
            {review.reviewer.is_verified && (
              <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            )}
            <View style={rv.rolePill}>
              <Text style={rv.roleText}>
                {review.reviewer_role === 'owner' ? 'Owner' : 'Renter'}
              </Text>
            </View>
          </View>
          <View style={rv.metaRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= review.rating ? 'star' : 'star-outline'}
                size={12}
                color={s <= review.rating ? '#F59E0B' : Colors.border}
              />
            ))}
            <Text style={rv.date}>{formatRelativeTime(review.created_at)}</Text>
          </View>
        </View>
      </View>
      <Text style={rv.comment}>{review.comment}</Text>
    </View>
  );
}

const rv = StyleSheet.create({
  item: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  header: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  initial: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  rolePill: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  roleText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 9,
    color: Colors.primary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  date: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginLeft: 4,
  },
  comment: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});

// ── Date Range Picker ─────────────────────────────────────────────────────────

function DateRangePicker({
  visible,
  onClose,
  onConfirm,
  blockedDates,
  pricePerDay,
  securityDeposit,
  minDays = 1,
  bottomInset = 0,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (start: string, end: string) => void;
  blockedDates: AvailabilityBlock[];
  pricePerDay: number;
  securityDeposit: number;
  minDays?: number;
  bottomInset?: number;
}) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = buildMonthGrid(year, month);

  function prevMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  function handleDay(iso: string) {
    if (isPast(iso) || isBlocked(iso, blockedDates)) return;
    if (!startDate || (startDate && endDate)) {
      setStartDate(iso); setEndDate(null); return;
    }
    if (iso <= startDate) {
      setStartDate(iso); setEndDate(null); return;
    }
    const days = daysBetween(startDate, iso);
    for (let i = 1; i < days; i++) {
      if (isBlocked(addDays(startDate, i), blockedDates)) {
        setStartDate(iso); setEndDate(null); return;
      }
    }
    setEndDate(iso);
  }

  function getDayStyle(iso: string) {
    const past = isPast(iso);
    const blocked = isBlocked(iso, blockedDates);
    const isStart = iso === startDate;
    const isEnd = iso === endDate;
    const inRange = !!(startDate && endDate && iso > startDate && iso < endDate);

    if (past || blocked) return { container: cal.dayDisabled, text: cal.dayTextDisabled, isStart: false, isEnd: false };
    if (isStart || isEnd) return { container: cal.daySelected, text: cal.dayTextSelected, isStart, isEnd };
    if (inRange) return { container: cal.dayInRange, text: cal.dayTextInRange, isStart: false, isEnd: false };
    return { container: cal.dayNormal, text: cal.dayTextNormal, isStart: false, isEnd: false };
  }

  const totalDays = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  const rentalTotal = totalDays * pricePerDay;
  const platformFee = Math.round(rentalTotal * 0.08);
  const totalCharged = rentalTotal + platformFee + securityDeposit;
  const minNotMet = totalDays > 0 && totalDays < minDays;
  const canConfirm = !!(startDate && endDate && totalDays >= minDays);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={cal.overlay} onPress={onClose} />
      <View style={[cal.sheet, { paddingBottom: bottomInset + Spacing.lg }]}>
        <View style={cal.handle} />

        {/* Header */}
        <View style={cal.headerRow}>
          <Text style={cal.title}>Select dates</Text>
          <Pressable style={cal.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Month navigation */}
        <View style={cal.monthRow}>
          <Pressable style={cal.navBtn} onPress={prevMonth} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
          </Pressable>
          <Text style={cal.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <Pressable style={cal.navBtn} onPress={nextMonth} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View style={cal.weekRow}>
          {DAYS_OF_WEEK.map((d) => (
            <Text key={d} style={cal.weekDay}>{d}</Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={cal.grid}>
          {grid.map((iso, idx) => {
            if (!iso) return <View key={`e-${idx}`} style={cal.dayCell} />;
            const { container, text, isStart, isEnd } = getDayStyle(iso);
            return (
              <Pressable
                key={iso}
                style={[cal.dayCell, container]}
                onPress={() => handleDay(iso)}
                disabled={isPast(iso) || isBlocked(iso, blockedDates)}
              >
                <Text style={[cal.dayText, text]}>{parseInt(iso.split('-')[2], 10)}</Text>
                {(isStart || isEnd) && (
                  <Text style={cal.dateLabel}>{isStart ? 'Start' : 'End'}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Selected range row */}
        {startDate && (
          <View style={cal.rangeRow}>
            <View style={cal.rangeItem}>
              <Text style={cal.rangeLabel}>Check-in</Text>
              <Text style={cal.rangeDate}>{formatDate(startDate)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
            <View style={cal.rangeItem}>
              <Text style={cal.rangeLabel}>Check-out</Text>
              <Text style={cal.rangeDate}>{endDate ? formatDate(endDate) : '—'}</Text>
            </View>
          </View>
        )}

        {/* Min days warning */}
        {minNotMet && (
          <View style={cal.warningBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={cal.warningText}>Minimum rental is {minDays} day{minDays > 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* Price summary */}
        {canConfirm && (
          <View style={cal.summary}>
            <View style={cal.summaryRow}>
              <Text style={cal.summaryLabel}>{formatPrice(pricePerDay)} × {totalDays} day{totalDays !== 1 ? 's' : ''}</Text>
              <Text style={cal.summaryValue}>{formatPrice(rentalTotal)}</Text>
            </View>
            <View style={cal.summaryRow}>
              <Text style={cal.summaryLabel}>Platform fee (8%)</Text>
              <Text style={cal.summaryValue}>{formatPrice(platformFee)}</Text>
            </View>
            <View style={cal.summaryRow}>
              <Text style={cal.summaryLabel}>Security deposit</Text>
              <Text style={cal.summaryValue}>{formatPrice(securityDeposit)}</Text>
            </View>
            <View style={cal.summaryDivider} />
            <View style={cal.summaryRow}>
              <Text style={cal.totalLabel}>Total</Text>
              <Text style={cal.totalValue}>{formatPrice(totalCharged)}</Text>
            </View>
          </View>
        )}

        <Button
          label={canConfirm ? `Continue  ·  ${formatPrice(totalCharged)}` : 'Select dates above'}
          onPress={() => canConfirm && onConfirm(startDate!, endDate!)}
          size="lg"
        />
      </View>
    </Modal>
  );
}

// ── Product Detail Screen ──────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [imageIndex, setImageIndex] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const sliderRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProduct(id),
    enabled: !!id,
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['availability', id],
    queryFn: () => productService.getAvailability(id),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => bookingService.getReviewsForProduct(id),
    enabled: !!id,
  });

  function goToImage(index: number) {
    const clamped = Math.max(0, Math.min(index, images.length - 1));
    setImageIndex(clamped);
    sliderRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
  }

  // ── Loading ─────────────────────────────────────────────
  if (isLoading || !product) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isOwner = product.owner.id === user?.id;
  const images = product.images.length > 0
    ? product.images
    : [{ image: 'https://placehold.co/400x300/E2E8F0/94A3B8?text=No+image', is_primary: true, id: '0', order: 0 }];

  const conditionColor: Record<string, string> = {
    excellent: Colors.success,
    good: Colors.primary,
    fair: Colors.warning,
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Image slider ──────────────────────────────── */}
        <View style={styles.imageWrap}>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
            }
          >
            {images.map((img, i) => (
              <Image
                key={img.id ?? i}
                source={{ uri: img.image }}
                style={styles.sliderImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Back button */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + Spacing.sm }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </Pressable>

          {/* Prev / next arrows */}
          {images.length > 1 && imageIndex > 0 && (
            <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goToImage(imageIndex - 1)}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </Pressable>
          )}
          {images.length > 1 && imageIndex < images.length - 1 && (
            <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goToImage(imageIndex + 1)}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </Pressable>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <Pressable key={i} onPress={() => goToImage(i)}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <View style={[styles.counter, { top: insets.top + Spacing.sm }]}>
              <Text style={styles.counterText}>{imageIndex + 1} / {images.length}</Text>
            </View>
          )}
        </View>

        {/* ── Body ──────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Title + condition */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title}</Text>
            <View style={[styles.conditionBadge, { borderColor: conditionColor[product.condition] + '55' }]}>
              <View style={[styles.conditionDot, { backgroundColor: conditionColor[product.condition] }]} />
              <Text style={[styles.conditionText, { color: conditionColor[product.condition] }]}>
                {product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
              </Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{formatPricePerDay(product.price_per_day)}</Text>
            <Text style={styles.deposit}>+ {formatPrice(product.security_deposit)} deposit</Text>
          </View>

          {/* Rating */}
          <StarRating rating={product.avg_rating} count={product.review_count} />

          {/* Divider */}
          <View style={styles.divider} />

          {/* Owner card */}
          <View style={[styles.ownerCard, Shadow.sm]}>
            {product.owner.profile?.avatar ? (
              <Image source={{ uri: product.owner.profile.avatar }} style={styles.ownerAvatarImg} />
            ) : (
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerInitial}>{product.owner.full_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.ownerInfo}>
              <View style={styles.ownerNameRow}>
                <Text style={styles.ownerName}>{product.owner.full_name}</Text>
                {product.owner.is_verified && (
                  <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                )}
              </View>
              <Text style={styles.ownerSub}>
                {product.owner.profile.total_listings} listing{product.owner.profile.total_listings !== 1 ? 's' : ''}
                {parseFloat(product.owner.profile.avg_owner_rating) > 0
                  ? `  ·  ${parseFloat(product.owner.profile.avg_owner_rating).toFixed(1)} ★`
                  : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* About */}
          <Text style={styles.sectionLabel}>About this item</Text>
          <Text style={styles.description}>{product.description}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Details */}
          <Text style={styles.sectionLabel}>Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.detailText}>{product.pickup_location}</Text>
            </View>
            <View style={styles.detailSep} />
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.detailText}>Listed {formatDate(product.created_at)}</Text>
            </View>
          </View>

          {/* Reviews */}
          {(reviews.length > 0 || product.review_count > 0) && (
            <>
              <View style={styles.divider} />
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionLabel}>Reviews</Text>
                {product.review_count > 3 && (
                  <Pressable
                    onPress={() => router.push({
                      pathname: '/review/list',
                      params: { productId: id, productTitle: product.title },
                    })}
                    hitSlop={8}
                  >
                    <Text style={styles.seeAll}>See all {product.review_count}</Text>
                  </Pressable>
                )}
              </View>
              {reviews.slice(0, 3).map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
              {product.review_count > 3 && (
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => router.push({
                    pathname: '/review/list',
                    params: { productId: id, productTitle: product.title },
                  })}
                >
                  <Text style={styles.seeAllBtnText}>
                    See all {product.review_count} reviews
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </Pressable>
              )}
            </>
          )}

          {/* Not available banner */}
          {!product.is_available && (
            <View style={styles.unavailableBanner}>
              <Ionicons name="time-outline" size={18} color={Colors.warning} />
              <Text style={styles.unavailableText}>
                This item is currently unavailable for booking.
              </Text>
            </View>
          )}

          {/* Book trigger (renters only) */}
          {!isOwner && product.is_available && (
            <Pressable style={styles.bookTrigger} onPress={() => setCalendarOpen(true)}>
              <View style={styles.bookTriggerLeft}>
                <View style={styles.bookTriggerIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.bookTriggerTitle}>Select rental dates</Text>
                  <Text style={styles.bookTriggerSub}>Tap to choose your period</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky footer ─────────────────────────────── */}
      {!isOwner && product.is_available && (
        <View style={[styles.footer, Shadow.lg, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View>
            <Text style={styles.footerPrice}>{formatPricePerDay(product.price_per_day)}</Text>
            <Text style={styles.footerSub}>Security deposit: {formatPrice(product.security_deposit)}</Text>
          </View>
          <Button
            label="Book now"
            onPress={() => setCalendarOpen(true)}
            fullWidth={false}
            size="md"
          />
        </View>
      )}

      {isOwner && (
        <View style={[styles.footer, Shadow.lg, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Text style={styles.ownerFooterHint}>You own this listing</Text>
          <Button
            label="Edit listing"
            variant="outline"
            onPress={() => router.push(`/listing/edit/${product.id}`)}
            fullWidth={false}
            size="md"
          />
        </View>
      )}

      {/* ── Calendar modal ────────────────────────────── */}
      <DateRangePicker
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(start, end) => {
          setCalendarOpen(false);
          router.push({
            pathname: '/checkout/[bookingId]',
            params: { bookingId: 'new', productId: id, startDate: start, endDate: end },
          });
        }}
        blockedDates={availability}
        pricePerDay={product.price_per_day}
        securityDeposit={product.security_deposit}
        minDays={1}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Image slider ────────────────────────────────────────
  imageWrap: { position: 'relative', height: IMAGE_HEIGHT },
  sliderImage: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT },

  backBtn: {
    position: 'absolute',
    left: Spacing.base,
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -19,
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  arrowLeft: { left: Spacing.md },
  arrowRight: { right: Spacing.md },

  dotsRow: {
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 18, backgroundColor: Colors.surface, borderRadius: 3 },

  counter: {
    position: 'absolute',
    right: Spacing.base,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  counterText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs, color: '#fff' },

  // ── Body ────────────────────────────────────────────────
  body: { padding: Spacing.base, gap: Spacing.md },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.xl * 1.3,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  conditionDot: { width: 6, height: 6, borderRadius: 3 },
  conditionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
  },

  // ── Pricing ─────────────────────────────────────────────
  priceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  price: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.primary,
  },
  deposit: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  // ── Owner card ──────────────────────────────────────────
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '44',
  },
  ownerAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  ownerInitial: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, color: Colors.primary },
  ownerInfo: { flex: 1, gap: 2 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  ownerSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },

  // ── About / Description ─────────────────────────────────
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  description: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.base * 1.7,
  },

  // ── Details card ────────────────────────────────────────
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  detailSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: Spacing.md + 32 + Spacing.md },

  // ── Reviews section ─────────────────────────────────────
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  seeAllBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Not available banner ─────────────────────────────────
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  unavailableText: {
    flex: 1,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Book trigger ────────────────────────────────────────
  bookTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    ...Shadow.sm,
  },
  bookTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  bookTriggerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTriggerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
  bookTriggerSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerPrice: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, color: Colors.textPrimary },
  footerSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  ownerFooterHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textTertiary },
});

// ── Calendar styles ───────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.textPrimary },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  weekRow: { flexDirection: 'row' },
  weekDay: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    paddingVertical: 4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: DAY_SIZE, height: DAY_SIZE + 6, alignItems: 'center', justifyContent: 'center' },
  dayNormal: {},
  dayDisabled: { opacity: 0.2 },
  daySelected: { backgroundColor: Colors.primary, borderRadius: Radius.md },
  dayInRange: { backgroundColor: Colors.primarySurface, borderRadius: Radius.xs },

  dayText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  dayTextNormal: { color: Colors.textPrimary },
  dayTextDisabled: { color: Colors.textTertiary },
  dayTextSelected: { color: Colors.textInverse, fontFamily: Typography.fontFamily.bold },
  dayTextInRange: { color: Colors.primary },
  dateLabel: { fontSize: 7, color: Colors.textInverse, fontFamily: Typography.fontFamily.medium, marginTop: -1 },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  rangeItem: { flex: 1, gap: 2 },
  rangeLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeDate: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.textPrimary },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorSurface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  warningText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.error },

  summary: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  summaryValue: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textPrimary },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  totalLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  totalValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.base, color: Colors.primary },
});
