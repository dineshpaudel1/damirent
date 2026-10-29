/**
 * Verification dashboard — accessible only to paudeldinesh961@gmail.com.
 *
 * This screen is a UI convenience; all actual authorization is enforced on the
 * backend. The backend will reject requests from any account other than the
 * designated administrator regardless of what the client sends.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { VerificationRequest } from '@/types';

// ── Document image ─────────────────────────────────────────────────────────

function DocImage({
  userId,
  side,
}: {
  userId: string;
  side: 'front' | 'back';
}) {
  const [source, setSource] = React.useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    authService.getAdminDocumentSource(userId, side).then(setSource);
  }, [userId, side]);

  if (!source) {
    return (
      <View style={docStyles.placeholder}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (errored) {
    return (
      <View style={docStyles.placeholder}>
        <Ionicons name="image-outline" size={24} color={Colors.textTertiary} />
        <Text style={docStyles.errorText}>Could not load</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={docStyles.image}
      resizeMode="contain"
      onError={() => setErrored(true)}
    />
  );
}

const docStyles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
});

// ── Rejection modal ────────────────────────────────────────────────────────

interface RejectModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

function RejectModal({ visible, onCancel, onConfirm, loading }: RejectModalProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please provide a rejection reason.');
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Reject verification</Text>
          <Text style={modalStyles.subtitle}>
            Provide a reason so the user knows what to correct when resubmitting.
          </Text>

          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Document is blurry or partially hidden"
            placeholderTextColor={Colors.textTertiary}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!loading}
          />

          <View style={modalStyles.actions}>
            <Pressable style={modalStyles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.rejectBtn, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={modalStyles.rejectText}>Reject</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textInverse,
  },
});

// ── Verification card ──────────────────────────────────────────────────────

function VerificationCard({
  item,
  onApprove,
  onReject,
  approving,
}: {
  item: VerificationRequest;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}) {
  const [docVisible, setDocVisible] = useState(false);

  return (
    <View style={[styles.card, Shadow.sm]}>
      {/* User info */}
      <View style={styles.userRow}>
        {item.user.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
        ) : (
          <View style={styles.userAvatarCircle}>
            <Text style={styles.userAvatarInitial}>
              {item.user.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user.full_name}</Text>
          <Text style={styles.userEmail}>{item.user.email}</Text>
          {item.submitted_at && (
            <Text style={styles.submittedAt}>
              Submitted {new Date(item.submitted_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Documents */}
      <Pressable
        style={styles.docsToggle}
        onPress={() => setDocVisible((v) => !v)}
      >
        <Ionicons
          name={docVisible ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={Colors.primary}
        />
        <Text style={styles.docsToggleText}>
          {docVisible ? 'Hide documents' : 'View documents'}
        </Text>
      </Pressable>

      {docVisible && (
        <View style={styles.docsRow}>
          <View style={styles.docWrapper}>
            <Text style={styles.docLabel}>Front side</Text>
            <View style={styles.docImageBox}>
              <DocImage userId={item.user.id} side="front" />
            </View>
          </View>
          <View style={styles.docWrapper}>
            <Text style={styles.docLabel}>Back side</Text>
            <View style={styles.docImageBox}>
              <DocImage userId={item.user.id} side="back" />
            </View>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.rejectBtn, approving && { opacity: 0.5 }]}
          onPress={onReject}
          disabled={approving}
        >
          <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.rejectBtnText}>Reject</Text>
        </Pressable>

        <Pressable
          style={[styles.approveBtn, approving && { opacity: 0.6 }]}
          onPress={onApprove}
          disabled={approving}
        >
          {approving ? (
            <ActivityIndicator size="small" color={Colors.textInverse} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textInverse} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function VerificationDashboardScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const { data: pending, isLoading, error } = useQuery({
    queryKey: ['verification-pending'],
    queryFn: authService.getPendingVerifications,
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (userId: string) => authService.approveVerification(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-pending'] });
      Alert.alert('Approved', 'The verification request has been approved.');
    },
    onError: () => Alert.alert('Error', 'Could not approve. Please try again.'),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      authService.rejectVerification(userId, reason),
    onSuccess: () => {
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['verification-pending'] });
      Alert.alert('Rejected', 'The verification request has been rejected.');
    },
    onError: () => Alert.alert('Error', 'Could not reject. Please try again.'),
  });

  // Guard: this screen should only be reachable for the admin, but add a UI
  // safety net in case someone navigates here directly.
  if (!user || user.email !== 'paudeldinesh961@gmail.com') {
    return (
      <View style={[styles.root, styles.centred, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed" size={40} color={Colors.textTertiary} />
        <Text style={styles.forbiddenText}>Not authorized</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verification dashboard</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading && (
        <View style={[styles.centred, { flex: 1 }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {error && !isLoading && (
        <View style={[styles.centred, { flex: 1 }]}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          <Text style={styles.errorText}>Could not load pending submissions.</Text>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing['3xl'] },
          ]}
        >
          {/* Summary */}
          <View style={[styles.summaryCard, Shadow.sm]}>
            <Ionicons name="people-outline" size={20} color={Colors.primary} />
            <Text style={styles.summaryText}>
              {pending?.length === 0
                ? 'No pending submissions'
                : `${pending?.length} submission${(pending?.length ?? 0) !== 1 ? 's' : ''} awaiting review`}
            </Text>
          </View>

          {pending?.map((item) => (
            <VerificationCard
              key={item.id}
              item={item}
              onApprove={() => approve.mutate(item.user.id)}
              onReject={() => setRejectTarget(item.user.id)}
              approving={approve.isPending && approve.variables === item.user.id}
            />
          ))}

          {pending?.length === 0 && (
            <View style={[styles.centred, { paddingVertical: Spacing['3xl'] }]}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.success} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>
                No identity verification requests are pending.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Rejection modal */}
      <RejectModal
        visible={rejectTarget !== null}
        loading={reject.isPending}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (rejectTarget) {
            reject.mutate({ userId: rejectTarget, reason });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  forbiddenText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textTertiary,
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

  // ── Content ──────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
  },

  // ── Summary ──────────────────────────────────────────────
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
  },
  summaryText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },

  // ── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },

  // ── User row ─────────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.primary,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  userEmail: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  submittedAt: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },

  // ── Documents toggle ─────────────────────────────────────
  docsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
  },
  docsToggleText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Documents row ────────────────────────────────────────
  docsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  docWrapper: {
    flex: 1,
    gap: Spacing.xs,
  },
  docLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docImageBox: {
    height: 160,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // ── Action buttons ───────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.error + '55',
    backgroundColor: Colors.errorSurface,
  },
  rejectBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.error,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
  },
  approveBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textInverse,
  },

  // ── Empty state ──────────────────────────────────────────
  emptyTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Error ────────────────────────────────────────────────
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
