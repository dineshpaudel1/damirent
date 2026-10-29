import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

export default function EditProfileScreen() {
  const { user, setUser, refreshUser } = useAuthStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<{ full_name?: string; email?: string; form?: string }>({});
  const [photoLoading, setPhotoLoading] = useState(false);

  // Local URI while upload is in progress (shows optimistic preview)
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);

  const avatar = localPhotoUri ?? user?.profile?.avatar ?? null;
  const initial = (user?.full_name ?? '?').charAt(0).toUpperCase();

  const update = useMutation({
    mutationFn: () =>
      authService.updateMe({ full_name: fullName.trim(), email: email.trim() || undefined }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<ApiError>;
      const fieldErrors = axiosErr.response?.data?.field_errors ?? {};
      setErrors({
        full_name: fieldErrors.full_name?.[0],
        email: fieldErrors.email?.[0],
        form: axiosErr.response?.data?.error,
      });
    },
  });

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to upload a profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setLocalPhotoUri(asset.uri);
    setPhotoLoading(true);

    try {
      await authService.uploadProfilePhoto(asset.uri);
      await refreshUser();
    } catch {
      setLocalPhotoUri(null);
      Alert.alert('Upload failed', 'Could not upload your photo. Please try again.');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleRemovePhoto() {
    Alert.alert('Remove photo', 'Are you sure you want to remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoLoading(true);
          try {
            await authService.deleteProfilePhoto();
            setLocalPhotoUri(null);
            await refreshUser();
          } catch {
            Alert.alert('Error', 'Could not remove your photo. Please try again.');
          } finally {
            setPhotoLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Sticky header ──────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar upload ───────────────────────────────── */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickPhoto}
            disabled={photoLoading}
            style={styles.avatarWrapper}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}

            {/* Camera overlay */}
            <View style={[styles.cameraOverlay, photoLoading && styles.cameraOverlayLoading]}>
              <Ionicons
                name={photoLoading ? 'hourglass-outline' : 'camera'}
                size={16}
                color={Colors.textInverse}
              />
            </View>
          </Pressable>

          <View style={styles.avatarActions}>
            <Pressable onPress={handlePickPhoto} disabled={photoLoading}>
              <Text style={styles.avatarActionText}>
                {photoLoading ? 'Uploading…' : avatar ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>
            {avatar && !photoLoading && (
              <>
                <Text style={styles.avatarActionDot}>·</Text>
                <Pressable onPress={handleRemovePhoto}>
                  <Text style={[styles.avatarActionText, styles.avatarRemoveText]}>Remove</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ── Form card ──────────────────────────────────── */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionLabel}>Personal information</Text>

          {errors.form ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
              <Text style={styles.errorBannerText}>{errors.form}</Text>
            </View>
          ) : null}

          <View style={styles.fields}>
            <Input
              label="Full name"
              value={fullName}
              onChangeText={(v) => { setErrors((e) => ({ ...e, full_name: undefined })); setFullName(v); }}
              error={errors.full_name}
              autoCapitalize="words"
              returnKeyType="next"
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textTertiary} />}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={(v) => { setErrors((e) => ({ ...e, email: undefined })); setEmail(v); }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => update.mutate()}
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />}
            />
          </View>
        </View>

        {/* ── Account info (read-only) ─────────────────────── */}
        {(user?.phone || user?.is_verified !== undefined) && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.sectionLabel}>Account info</Text>

            {user?.phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="call-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              </View>
            )}

            {user?.phone && user?.is_verified !== undefined && (
              <View style={styles.infoSep} />
            )}

            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name={user?.is_verified ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={user?.is_verified ? Colors.success : Colors.textTertiary}
                />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Email verification</Text>
                <Text style={[
                  styles.infoValue,
                  { color: user?.is_verified ? Colors.success : Colors.textTertiary },
                ]}>
                  {user?.is_verified ? 'Email verified' : 'Not yet verified'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Save button ─────────────────────────────────── */}
        <Button
          label="Save changes"
          onPress={() => update.mutate()}
          loading={update.isPending}
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
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

  // ── Scroll ──────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },

  // ── Avatar upload ────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '44',
  },
  avatarInitial: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.primary,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  cameraOverlayLoading: {
    backgroundColor: Colors.textTertiary,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  avatarActionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  avatarActionDot: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  avatarRemoveText: {
    color: Colors.error,
  },

  // ── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Error banner ─────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.error + '33',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },

  // ── Fields ──────────────────────────────────────────────
  fields: {
    gap: Spacing.md,
  },

  // ── Info rows (read-only) ────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  infoSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 34 + Spacing.md,
  },
});
