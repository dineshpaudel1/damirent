import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { formatBookingStatus } from '@/utils/formatters';
import type { BookingStatus } from '@/types';

const STATUS_STYLES: Record<
  BookingStatus,
  { bg: string; text: string }
> = {
  pending_approval: { bg: Colors.statusPendingSurface, text: Colors.statusPending },
  approved: { bg: Colors.statusApprovedSurface, text: Colors.statusApproved },
  payment_pending: { bg: Colors.statusPendingSurface, text: Colors.statusPending },
  confirmed: { bg: Colors.statusConfirmedSurface, text: Colors.statusConfirmed },
  active: { bg: Colors.statusActiveSurface, text: Colors.statusActive },
  completed: { bg: Colors.statusCompletedSurface, text: Colors.statusCompleted },
  cancelled_by_renter: { bg: Colors.statusCancelledSurface, text: Colors.statusCancelled },
  cancelled_by_owner: { bg: Colors.statusCancelledSurface, text: Colors.statusCancelled },
  expired: { bg: Colors.statusCompletedSurface, text: Colors.statusCompleted },
  disputed: { bg: Colors.statusDisputedSurface, text: Colors.statusDisputed },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

export default function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const s = STATUS_STYLES[status];

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.text }]} />
      <Text style={[styles.label, { color: s.text }]}>{formatBookingStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
  },
});
