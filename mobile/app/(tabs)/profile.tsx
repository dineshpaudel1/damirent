import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

const VERIFICATION_ADMIN_EMAIL = 'paudeldinesh961@gmail.com';

// ── Verified badge ────────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <View style={styles.verifiedPill}>
      <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

// ── Verification status pill ──────────────────────────────────────────────────

function VerificationPill({ status }: { status: string }) {
  if (status === 'verified') return <VerifiedBadge />;

  if (status === 'pending') {
    return (
      <View style={[styles.verifiedPill, styles.pillPending]}>
        <Ionicons name="time-outline" size={13} color={Colors.warning} />
        <Text style={[styles.verifiedText, { color: Colors.warning }]}>Under review</Text>
      </View>
    );
  }

  return null;
}

// ── Menu row ─────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
  rightBadge?: string;
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  onPress,
  danger,
  showChevron = true,
  rightBadge,
}: MenuRowProps) {
  const resolvedBg = danger ? Colors.errorSurface : (iconBg ?? Colors.primarySurface);
  const resolvedColor = danger ? Colors.error : (iconColor ?? Colors.primary);

  return (
    <Pressable style={styles.row} onPress={onPress} android_ripple={{ color: Colors.border }}>
      <View style={[styles.rowIconWrap, { backgroundColor: resolvedBg }]}>
        <Ionicons name={icon} size={18} color={resolvedColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {rightBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{rightBadge}</Text>
        </View>
      ) : null}
      {showChevron && !danger && (
        <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
      )}
    </Pressable>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ── Stat item ─────────────────────────────────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => { await logout(); },
      },
    ]);
  }

  if (!user) return null;

  const profile = user.profile;
  const ownerRating = profile ? parseFloat(profile.avg_owner_rating) : 0;
  const renterRating = profile ? parseFloat(profile.avg_renter_rating) : 0;
  const listingCount = profile?.total_listings ?? 0;
  const rentalCount = profile?.total_rentals ?? 0;
  const initial = user.full_name.charAt(0).toUpperCase();

  // Identity verification — trusted from backend data only
  const ivStatus = user.identity_verification?.verification_status ?? 'not_submitted';
  const isIdentityVerified = ivStatus === 'verified';

  // Admin dashboard is only shown for the designated admin account.
  // The actual enforcement is on the backend; this is only a UI hint.
  const isAdmin = user.email === VERIFICATION_ADMIN_EMAIL;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push('/profile/edit')}
          hitSlop={8}
        >
          <Ionicons name="pencil-outline" size={17} color={Colors.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
      >

        {/* ── Hero card ───────────────────────────────────── */}
        <View style={[styles.heroCard, Shadow.sm]}>
          {/* Avatar */}
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}

          {/* Name + verified badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.full_name}</Text>
            {/* Show identity-verified badge (backed by backend approval) */}
            {isIdentityVerified && <VerifiedBadge />}
          </View>

          {/* Pending / review status (not shown when verified) */}
          {!isIdentityVerified && ivStatus !== 'not_submitted' && (
            <VerificationPill status={ivStatus} />
          )}

          {/* Contact info */}
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.contactText}>{user.email}</Text>
          </View>
          {user.phone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.contactText}>{user.phone}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatItem
              value={listingCount}
              label="Listings"
              icon="cube-outline"
              iconColor={Colors.primary}
            />
            <View style={styles.statDivider} />
            <StatItem
              value={rentalCount}
              label="Rentals"
              icon="repeat-outline"
              iconColor={Colors.secondary}
            />
            <View style={styles.statDivider} />
            <StatItem
              value={ownerRating > 0 ? ownerRating.toFixed(1) : '—'}
              label="Owner ★"
              icon="star"
              iconColor="#F59E0B"
            />
            <View style={styles.statDivider} />
            <StatItem
              value={renterRating > 0 ? renterRating.toFixed(1) : '—'}
              label="Renter ★"
              icon="star"
              iconColor="#F59E0B"
            />
          </View>
        </View>

        {/* ── Activity ────────────────────────────────────── */}
        <SectionLabel label="Activity" />
        <View style={[styles.menuCard, Shadow.sm]}>
          <MenuRow
            icon="cube-outline"
            label="My listings"
            sublabel={`${listingCount} item${listingCount !== 1 ? 's' : ''}`}
            rightBadge={listingCount > 0 ? String(listingCount) : undefined}
            onPress={() => router.push('/profile/listings')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="calendar-outline"
            label="My bookings"
            sublabel="View and manage your rentals"
            onPress={() => router.push('/(tabs)/bookings')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="add-circle-outline"
            iconBg={Colors.successSurface}
            iconColor={Colors.success}
            label="List a new item"
            sublabel="Earn by renting out your things"
            onPress={() => router.push('/listing/create')}
          />
        </View>

        {/* ── Account ─────────────────────────────────────── */}
        <SectionLabel label="Account" />
        <View style={[styles.menuCard, Shadow.sm]}>
          <MenuRow
            icon="person-outline"
            label="Edit profile"
            sublabel="Name, photo, and contact details"
            onPress={() => router.push('/profile/edit')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon={isIdentityVerified ? 'shield-checkmark' : 'shield-outline'}
            iconBg={isIdentityVerified ? Colors.successSurface : Colors.primarySurface}
            iconColor={isIdentityVerified ? Colors.success : Colors.primary}
            label="Identity verification"
            sublabel={
              ivStatus === 'verified'
                ? 'Your identity is verified'
                : ivStatus === 'pending'
                ? 'Under review'
                : ivStatus === 'rejected'
                ? 'Rejected — resubmit documents'
                : 'Verify your identity'
            }
            onPress={() => router.push('/profile/verification')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="notifications-outline"
            label="Notifications"
            sublabel="Stay updated on your activity"
            onPress={() => router.push('/(tabs)/inbox')}
          />
        </View>

        {/* ── Admin section (only for paudeldinesh961@gmail.com) ─── */}
        {isAdmin && (
          <>
            <SectionLabel label="Administration" />
            <View style={[styles.menuCard, Shadow.sm]}>
              <MenuRow
                icon="people-outline"
                iconBg={Colors.warningSurface}
                iconColor={Colors.warning}
                label="Verification dashboard"
                sublabel="Review pending identity submissions"
                onPress={() => router.push('/admin/verification-dashboard')}
              />
            </View>
          </>
        )}

        {/* ── Sign out ────────────────────────────────────── */}
        <View style={[styles.menuCard, Shadow.sm]}>
          <MenuRow
            icon="log-out-outline"
            label="Sign out"
            onPress={handleLogout}
            danger
            showChevron={false}
          />
        </View>

        <Text style={styles.versionText}>DamiRent · v1.0.0</Text>

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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  editBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Scroll ──────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },

  // ── Hero card ───────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
  pillPending: {
    backgroundColor: Colors.warningSurface,
  },
  verifiedText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Stats ───────────────────────────────────────────────
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

  // ── Section label ────────────────────────────────────────
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },

  // ── Menu card ───────────────────────────────────────────
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 36 + Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    minHeight: 60,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  rowLabelDanger: {
    color: Colors.error,
  },
  rowSublabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
    color: Colors.primary,
  },

  // ── Version ─────────────────────────────────────────────
  versionText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingTop: Spacing.md,
  },
});
