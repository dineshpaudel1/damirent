import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '@/services/product.service';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { ProductCondition, ApiError } from '@/types';
import { AxiosError } from 'axios';

const CONDITIONS: { value: ProductCondition; label: string; desc: string; icon: string }[] = [
  { value: 'excellent', label: 'Excellent', desc: 'Like new, no visible wear', icon: '✨' },
  { value: 'good', label: 'Good', desc: 'Minor wear, fully functional', icon: '👍' },
  { value: 'fair', label: 'Fair', desc: 'Visible wear but works well', icon: '👌' },
];

const MAX_IMAGES = 5;
const THUMB_SIZE = 88;

export default function CreateListingScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Gate: require identity verification before listing
  const verificationStatus = user?.identity_verification?.verification_status;
  const isVerified = verificationStatus === 'verified';

  if (!isVerified) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>List an item</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={gateStyles.wrap}>
          <View style={gateStyles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={gateStyles.title}>Verification required</Text>
          <Text style={gateStyles.body}>
            {verificationStatus === 'pending'
              ? 'Your identity documents are under review. You will be able to publish listings once our team verifies your account.'
              : verificationStatus === 'rejected'
              ? 'Your previous verification was rejected. Please re-submit your documents from your profile page.'
              : 'To publish listings you must verify your identity. It only takes a few minutes.'}
          </Text>
          <Pressable
            style={gateStyles.btn}
            onPress={() => router.replace('/profile/verification')}
          >
            <Ionicons name="arrow-forward-circle-outline" size={18} color={Colors.textInverse} />
            <Text style={gateStyles.btnText}>
              {verificationStatus === 'pending' ? 'View verification status' : 'Start verification'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ProductCondition>('good');
  const [pricePerDay, setPricePerDay] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [images, setImages] = useState<Array<{ uri: string; mimeType: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.listCategories(),
  });

  const selectedCategoryName = (categories ?? []).find((c) => String(c.id) === categoryId)?.name;

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    }
  }

  const create = useMutation({
    mutationFn: () =>
      productService.createProduct({
        title: title.trim(),
        description: description.trim(),
        condition,
        price_per_day: parseInt(pricePerDay, 10),
        security_deposit: parseInt(securityDeposit, 10),
        pickup_location: pickupLocation.trim(),
        category: categoryId as unknown as number,
      }),
    onSuccess: async (product) => {
      if (images.length > 0) {
        setUploading(true);
        try {
          for (let i = 0; i < images.length; i++) {
            await productService.uploadProductImage(
              product.id,
              images[i].uri,
              i === 0,
              images[i].mimeType,
            );
          }
        } finally {
          setUploading(false);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.replace(`/product/${product.id}`);
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<ApiError>;
      const fieldErrors = axiosErr.response?.data?.field_errors ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([k, v]) => {
        mapped[k] = Array.isArray(v) ? v[0] : String(v);
      });
      setErrors(mapped);
    },
  });

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!categoryId) e.category = 'Select a category';
    if (!pricePerDay || parseInt(pricePerDay, 10) <= 0)
      e.price_per_day = 'Enter a valid daily price';
    if (securityDeposit === '' || parseInt(securityDeposit, 10) < 0)
      e.security_deposit = 'Enter a valid deposit amount';
    if (!pickupLocation.trim()) e.pickup_location = 'Pickup location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    create.mutate();
  }

  const isLoading = create.isPending || uploading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Sticky header ─────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>List an item</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Scrollable form ────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing['3xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Photos ─────────────────────────────────────── */}
          <FormSection title="Photos" hint={`${images.length} / ${MAX_IMAGES}`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.imageRow}>
                {images.map((img, index) => (
                  <View key={img.uri} style={styles.thumb}>
                    <Image source={{ uri: img.uri }} style={styles.thumbImg} />
                    {index === 0 && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.badgeText}>Primary</Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => setImages((p) => p.filter((i) => i.uri !== img.uri))}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <Pressable style={styles.addPhoto} onPress={pickImages}>
                    <Ionicons name="camera-outline" size={24} color={Colors.textTertiary} />
                    <Text style={styles.addPhotoLabel}>Add photos</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
            {images.length === 0 && (
              <Text style={styles.photoHint}>
                Good photos help renters choose your item. First photo becomes the cover.
              </Text>
            )}
          </FormSection>

          {/* ── Basic info ──────────────────────────────────── */}
          <FormSection title="Basic info">
            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <Pressable
                style={[styles.dropdown, errors.category && styles.dropdownError]}
                onPress={() => setCategoryOpen(true)}
              >
                <Text style={selectedCategoryName ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {selectedCategoryName ?? 'Select a category'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
              </Pressable>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </View>

            <Input
              label="Title"
              placeholder="e.g. Sony A7III Camera with 24-70mm lens"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
              maxLength={120}
              returnKeyType="next"
            />

            <Input
              label="Description"
              placeholder="Describe your item — condition, what's included, any caveats…"
              value={description}
              onChangeText={setDescription}
              error={errors.description}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100 }}
              textAlignVertical="top"
            />
          </FormSection>

          {/* ── Condition ────────────────────────────────────── */}
          <FormSection title="Condition">
            <View style={styles.conditionGrid}>
              {CONDITIONS.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.conditionCard, condition === c.value && styles.conditionCardActive]}
                  onPress={() => setCondition(c.value)}
                >
                  <Text style={styles.conditionIcon}>{c.icon}</Text>
                  <Text style={[styles.conditionLabel, condition === c.value && styles.conditionLabelActive]}>
                    {c.label}
                  </Text>
                  <Text style={styles.conditionDesc}>{c.desc}</Text>
                  {condition === c.value && (
                    <View style={styles.conditionCheck}>
                      <Ionicons name="checkmark" size={12} color={Colors.primary} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </FormSection>

          {/* ── Pricing ──────────────────────────────────────── */}
          <FormSection title="Pricing">
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Input
                  label="Price per day (NPR)"
                  placeholder="500"
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  error={errors.price_per_day}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.priceField}>
                <Input
                  label="Security deposit (NPR)"
                  placeholder="2000"
                  value={securityDeposit}
                  onChangeText={setSecurityDeposit}
                  error={errors.security_deposit}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
              </View>
            </View>
            <View style={styles.pricingNote}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.pricingNoteText}>
                DamiRent keeps 8% of the rental total as a platform fee.
              </Text>
            </View>
          </FormSection>

          {/* ── Location ─────────────────────────────────────── */}
          <FormSection title="Location">
            <Input
              label="Pickup location"
              placeholder="e.g. Thamel, Kathmandu"
              value={pickupLocation}
              onChangeText={setPickupLocation}
              error={errors.pickup_location}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </FormSection>

          {/* ── Submit ────────────────────────────────────────── */}
          {uploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading photos…</Text>
            </View>
          )}

          <Button
            label="Publish listing"
            onPress={handleSubmit}
            loading={isLoading}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Category modal ────────────────────────────────── */}
      <Modal visible={categoryOpen} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setCategoryOpen(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.base }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select category</Text>
          <FlatList
            data={categories ?? []}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const active = String(item.id) === categoryId;
              return (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => { setCategoryId(String(item.id)); setCategoryOpen(false); }}
                >
                  <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.modalSep} />}
          />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable section wrapper ─────────────────────────────────────────────────
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.titleRow}>
        <Text style={sectionStyles.title}>{title}</Text>
        {hint ? <Text style={sectionStyles.hint}>{hint}</Text> : null}
      </View>
      <View style={[sectionStyles.card, Shadow.sm]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  title: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
});

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
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    gap: Spacing.xl,
  },

  // ── Photos ──────────────────────────────────────────────
  imageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(43,57,144,0.85)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: '#fff',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  photoHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },

  // ── Field group ─────────────────────────────────────────
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 3,
  },
  dropdownError: { borderColor: Colors.borderError },
  dropdownPlaceholder: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
  dropdownValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },

  // ── Condition ───────────────────────────────────────────
  conditionGrid: { gap: Spacing.sm },
  conditionCard: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    position: 'relative',
  },
  conditionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  conditionIcon: { fontSize: 20, marginBottom: 4 },
  conditionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  conditionLabelActive: { color: Colors.primary },
  conditionDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  conditionCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Pricing ─────────────────────────────────────────────
  priceRow: { flexDirection: 'row', gap: Spacing.md },
  priceField: { flex: 1 },
  pricingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  pricingNoteText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    lineHeight: Typography.fontSize.sm * 1.5,
  },

  // ── Uploading ───────────────────────────────────────────
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  uploadingText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Category modal ──────────────────────────────────────
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing.base,
    maxHeight: '65%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  modalItemText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  modalItemTextActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  modalSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});

// ── Verification gate styles ─────────────────────────────────────────────────
const gateStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.6,
  },
  btn: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  btnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textInverse,
  },
});
