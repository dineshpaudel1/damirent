import React from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '@/services/booking.service';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { formatRelativeTime } from '@/utils/formatters';
import type { Notification, NotificationType } from '@/types';

// ── Icon config per notification type ────────────────────────────────────────

type IconConfig = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

const ICON_MAP: Record<NotificationType, IconConfig> = {
  booking_request: {
    name: 'calendar-outline',
    color: Colors.primary,
    bg: Colors.primarySurface,
  },
  booking_approved: {
    name: 'checkmark-circle-outline',
    color: Colors.success,
    bg: Colors.successSurface,
  },
  booking_cancelled: {
    name: 'close-circle-outline',
    color: Colors.error,
    bg: Colors.errorSurface,
  },
  booking_confirmed: {
    name: 'card-outline',
    color: Colors.primary,
    bg: Colors.primarySurface,
  },
  booking_active: {
    name: 'cube-outline',
    color: Colors.secondary,
    bg: Colors.secondarySurface,
  },
  booking_completed: {
    name: 'trophy-outline',
    color: '#D97706',
    bg: '#FEF3C7',
  },
  payment_received: {
    name: 'cash-outline',
    color: Colors.success,
    bg: Colors.successSurface,
  },
  review_received: {
    name: 'star-outline',
    color: '#D97706',
    bg: '#FEF3C7',
  },
  system: {
    name: 'information-circle-outline',
    color: Colors.textTertiary,
    bg: Colors.surfaceSecondary,
  },
};

// ── Notification row ──────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const cfg = ICON_MAP[notification.notification_type] ?? ICON_MAP.system;

  return (
    <Pressable
      style={[styles.row, !notification.is_read && styles.rowUnread, Shadow.sm]}
      onPress={onPress}
    >
      {/* Unread left bar */}
      {!notification.is_read && <View style={styles.unreadBar} />}

      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.name} size={20} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !notification.is_read && styles.rowTitleUnread]}>
            {notification.title}
          </Text>
          {!notification.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowBody} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.rowTime}>{formatRelativeTime(notification.created_at)}</Text>
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => bookingService.listNotifications(),
  });

  const markOne = useMutation({
    mutationFn: (notifId: string) => bookingService.markNotificationRead(notifId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => bookingService.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Notification[] = data?.results ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handlePress(n: Notification) {
    if (!n.is_read) markOne.mutate(n.id);
    const bookingId = n.data?.booking_id as string | undefined;
    if (bookingId) router.push(`/booking/${bookingId}`);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable
            style={styles.markAllBtn}
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            hitSlop={8}
          >
            {markAllRead.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={14} color={Colors.primary} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* ── List ──────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow notification={item} onPress={() => handlePress(item)} />
          )}
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
                <Ionicons name="notifications-outline" size={36} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>
                You'll see booking requests, payment updates, and reviews here.
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    color: '#fff',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  markAllText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },

  // ── List ────────────────────────────────────────────────
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },

  // ── Row ─────────────────────────────────────────────────
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  rowUnread: {
    backgroundColor: Colors.primarySurface,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
  },

  // ── Icon ────────────────────────────────────────────────
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Row content ─────────────────────────────────────────
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  rowTitleUnread: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  rowBody: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  rowTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // ── Loading ─────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty ───────────────────────────────────────────────
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
});
