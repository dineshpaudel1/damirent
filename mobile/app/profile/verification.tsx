import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { VerificationStatus } from '@/types';

// ── Document picker slot ───────────────────────────────────────────────────

interface DocSlotProps {
  label: string;
  description: string;
  uri: string | null;
  onPick: () => void;
  disabled?: boolean;
}

function DocSlot({ label, description, uri, onPick, disabled }: DocSlotProps) {
  return (
    <Pressable
      onPress={onPick}
      disabled={disabled}
      style={({ pressed }) => [
        styles.docSlot,
        pressed && !disabled && styles.docSlotPressed,
        uri && styles.docSlotFilled,
      ]}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.docPreview} resizeMode="cover" />
          <View style={styles.docOverlay}>
            <View style={styles.docChangeBadge}>
              <Ionicons name="camera" size={14} color={Colors.textInverse} />
              <Text style={styles.docChangeBadgeText}>Change</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.docEmpty}>
          <View style={styles.docIconCircle}>
            <Ionicons name="id-card-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.docSlotLabel}>{label}</Text>
          <Text style={styles.docSlotDesc}>{description}</Text>
          <View style={styles.docAddRow}>
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.docAddText}>Tap to upload</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ── Status banner ──────────────────────────────────────────────────────────

function StatusBanner({ status, rejectionReason }: { status: VerificationStatus; rejectionReason?: string }) {
  if (status === 'not_submitted') return null;

  const config: Record<Exclude<VerificationStatus, 'not_submitted'>, {
    bg: string; border: string; icon: string; iconColor: string; title: string; body: string;
  }> = {
    pending: {
      bg: Colors.warningSurface,
      border: Colors.warning + '44',
      icon: 'time-outline',
      iconColor: Colors.warning,
      title: 'Under review',
      body: 'Your identity documents have been submitted and are being reviewed. This usually takes 1–2 business days.',
    },
    verified: {
      bg: Colors.successSurface,
      border: Colors.success + '44',
      icon: 'checkmark-circle',
      iconColor: Colors.success,
      title: 'Identity verified',
      body: 'Your identity has been successfully verified. A verified badge is now displayed on your profile.',
    },
    rejected: {
      bg: Colors.errorSurface,
      border: Colors.error + '44',
      icon: 'close-circle-outline',
      iconColor: Colors.error,
      title: 'Verification rejected',
      body: rejectionReason
        ? `Your documents were rejected: ${rejectionReason}\n\nPlease upload new documents below.`
        : 'Your documents were rejected. Please upload new documents below.',
    },
  };

  const c = config[status as Exclude<VerificationStatus, 'not_submitted'>];

  return (
    <View style={[styles.statusBanner, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={c.icon as any} size={22} color={c.iconColor} />
      <View style={styles.statusBannerText}>
        <Text style={[styles.statusBannerTitle, { color: c.iconColor }]}>{c.title}</Text>
        <Text style={styles.statusBannerBody}>{c.body}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function VerificationScreen() {
  const { user, refreshUser } = useAuthStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['identity-verification'],
    queryFn: authService.getVerificationStatus,
    initialData: user?.identity_verification ?? undefined,
  });

  const submit = useMutation({
    mutationFn: () => authService.submitIdentityDocuments(frontUri!, backUri!),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['identity-verification'] });
      Alert.alert(
        'Documents submitted',
        'Your identity documents have been submitted for review. We will notify you once the review is complete.',
      );
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ??
        'Could not submit your documents. Please try again.';
      Alert.alert('Submission failed', msg);
    },
  });

  async function pickDocument(side: 'front' | 'back') {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to upload documents.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;

    if (side === 'front') setFrontUri(result.assets[0].uri);
    else setBackUri(result.assets[0].uri);
  }

  const verificationStatus = status?.verification_status ?? 'not_submitted';
  const canSubmit =
    verificationStatus === 'not_submitted' || verificationStatus === 'rejected';
  const readyToSubmit = canSubmit && !!frontUri && !!backUri;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Identity verification</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing['3xl'] },
          ]}
        >
          {/* ── Status banner ───────────────────────────── */}
          <StatusBanner
            status={verificationStatus}
            rejectionReason={status?.rejection_reason}
          />

          {/* ── Info card ────────────────────────────────── */}
          {canSubmit && (
            <View style={[styles.card, Shadow.sm]}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoText}>
                  Upload clear photos of both sides of your citizenship certificate or national
                  identity card. Make sure all text is legible and the full document is visible.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoText}>
                  Your documents are stored securely and are only accessible to our verification team.
                </Text>
              </View>
            </View>
          )}

          {/* ── Document upload slots ─────────────────────── */}
          {canSubmit && (
            <View style={styles.docsSection}>
              <Text style={styles.docsSectionLabel}>Upload your document</Text>

              <DocSlot
                label="Front side"
                description="Upload the front of your citizenship or national ID"
                uri={frontUri}
                onPick={() => pickDocument('front')}
                disabled={submit.isPending}
              />

              <DocSlot
                label="Back side"
                description="Upload the back of your citizenship or national ID"
                uri={backUri}
                onPick={() => pickDocument('back')}
                disabled={submit.isPending}
              />
            </View>
          )}

          {/* ── Verified state ────────────────────────────── */}
          {verificationStatus === 'verified' && (
            <View style={[styles.card, styles.verifiedCard, Shadow.sm]}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.verifiedTitle}>You are verified</Text>
              <Text style={styles.verifiedSubtitle}>
                Your verified badge is displayed on your profile and on your listings.
              </Text>
            </View>
          )}

          {/* ── Submit button ─────────────────────────────── */}
          {canSubmit && (
            <Button
              label={submit.isPending ? 'Submitting…' : 'Submit for verification'}
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={!readyToSubmit}
              size="lg"
            />
          )}

          {/* ── Pending state note ────────────────────────── */}
          {verificationStatus === 'pending' && (
            <View style={[styles.card, Shadow.sm]}>
              <Text style={styles.pendingNote}>
                Your submission is currently being reviewed. You will be notified when a decision
                is made. Please check back later.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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

  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ──────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingTop: Spacing.base,
  },

  // ── Status banner ────────────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.base,
  },
  statusBannerText: { flex: 1, gap: 4 },
  statusBannerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
  },
  statusBannerBody: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Info card ────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Document slots ───────────────────────────────────────
  docsSection: {
    gap: Spacing.md,
  },
  docsSectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
  },
  docSlot: {
    height: 180,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  docSlotPressed: { opacity: 0.75 },
  docSlotFilled: {
    borderStyle: 'solid',
    borderColor: Colors.primary + '44',
  },
  docPreview: {
    width: '100%',
    height: '100%',
  },
  docOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: Spacing.sm,
  },
  docChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  docChangeBadgeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textInverse,
  },
  docEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.base,
  },
  docIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  docSlotLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  docSlotDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  docAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  docAddText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Verified state ───────────────────────────────────────
  verifiedCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['2xl'],
  },
  verifiedTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.success,
  },
  verifiedSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Pending note ─────────────────────────────────────────
  pendingNote: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
