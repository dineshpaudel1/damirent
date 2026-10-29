import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '@/services/product.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { ProductCondition, ApiError, ProductImage } from '@/types';
import { AxiosError } from 'axios';

const CONDITIONS: { value: ProductCondition; label: string; desc: string; emoji: string }[] = [
  { value: 'excellent', label: 'Excellent', desc: 'Like new, no visible wear', emoji: '✨' },
  { value: 'good', label: 'Good', desc: 'Minor wear, fully functional', emoji: '👍' },
  { value: 'fair', label: 'Fair', desc: 'Visible wear but works well', emoji: '👌' },
];

const MAX_IMAGES = 5;

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={section.wrap}>
      <Text style={section.label}>{label}</Text>
      <View style={section.card}>{children}</View>
    </View>
  );
}

const section = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  label: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.sm,
  },
});

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ProductCondition>('good');
  const [pricePerDay, setPricePerDay] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProduct(id!),
    enabled: !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.listCategories(),
  });

  useEffect(() => {
    if (product && !ready) {
      setTitle(product.title);
      setDescription(product.description);
      setCondition(product.condition);
      setPricePerDay(String(product.price_per_day));
      setSecurityDeposit(String(product.security_deposit));
      setPickupLocation(product.pickup_location);
      setCategoryId(String(product.category.id));
      setExistingImages(product.images);
      setReady(true);
    }
  }, [product, ready]);

  const totalImages = existingImages.length + newImages.length;

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - totalImages,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setNewImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES - existingImages.length));
    }
  }

  async function deleteExistingImage(image: ProductImage) {
    Alert.alert('Remove photo', 'Remove this photo from your listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await productService.deleteProductImage(id!, image.id);
            setExistingImages((prev) => prev.filter((i) => i.id !== image.id));
            queryClient.invalidateQueries({ queryKey: ['product', id] });
          } catch {
            Alert.alert('Error', 'Could not remove the photo. Try again.');
          }
        },
      },
    ]);
  }

  const update = useMutation({
    mutationFn: () =>
      productService.updateProduct(id!, {
        title: title.trim(),
        description: description.trim(),
        condition,
        price_per_day: parseInt(pricePerDay, 10),
        security_deposit: parseInt(securityDeposit, 10),
        pickup_location: pickupLocation.trim(),
        category: categoryId as unknown as number,
      }),
    onSuccess: async (updated) => {
      if (newImages.length > 0) {
        setUploading(true);
        try {
          const isPrimaryNeeded = existingImages.length === 0;
          for (let i = 0; i < newImages.length; i++) {
            await productService.uploadProductImage(updated.id, newImages[i], isPrimaryNeeded && i === 0);
          }
        } finally {
          setUploading(false);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.back();
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
    if (!pricePerDay || isNaN(parseInt(pricePerDay, 10)) || parseInt(pricePerDay, 10) <= 0)
      e.price_per_day = 'Enter a valid daily price (NPR)';
    if (!securityDeposit || isNaN(parseInt(securityDeposit, 10)) || parseInt(securityDeposit, 10) < 0)
      e.security_deposit = 'Enter a valid security deposit amount';
    if (!pickupLocation.trim()) e.pickup_location = 'Pickup location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const selectedCategoryName = (categories ?? []).find((c) => String(c.id) === categoryId)?.name;
  const isSaving = update.isPending || uploading;

  if (isLoading || !ready) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Sticky header ─────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit listing</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Scrollable form ───────────────────────────────── */}
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
          {/* ── Photos ────────────────────────────────────── */}
          <FormSection label={`Photos (${totalImages}/${MAX_IMAGES})`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.imageRow}>
                {existingImages.map((img, index) => (
                  <View key={img.id} style={styles.imageThumb}>
                    <Image source={{ uri: img.image }} style={styles.thumbImg} />
                    {index === 0 && existingImages[0]?.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                    <Pressable style={styles.removeBtn} onPress={() => deleteExistingImage(img)}>
                      <Ionicons name="close" size={11} color="#fff" />
                    </Pressable>
                  </View>
                ))}

                {newImages.map((uri) => (
                  <View key={uri} style={styles.imageThumb}>
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>New</Text>
                    </View>
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => setNewImages((prev) => prev.filter((u) => u !== uri))}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </Pressable>
                  </View>
                ))}

                {totalImages < MAX_IMAGES && (
                  <Pressable style={styles.addPhoto} onPress={pickImages}>
                    <Ionicons name="camera-outline" size={24} color={Colors.textTertiary} />
                    <Text style={styles.addPhotoLabel}>Add photos</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </FormSection>

          {/* ── Basic info ────────────────────────────────── */}
          <FormSection label="Basic info">
            {/* Category picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              {errors.category ? (
                <Text style={styles.fieldError}>{errors.category}</Text>
              ) : null}
              <Pressable
                style={[styles.categoryBtn, errors.category ? styles.categoryBtnError : null]}
                onPress={() => setCategoryOpen(true)}
              >
                <Text style={selectedCategoryName ? styles.categoryValue : styles.categoryPlaceholder}>
                  {selectedCategoryName ?? 'Select a category'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
              maxLength={120}
              returnKeyType="next"
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              error={errors.description}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100 }}
              textAlignVertical="top"
            />
          </FormSection>

          {/* ── Condition ─────────────────────────────────── */}
          <FormSection label="Condition">
            {CONDITIONS.map((c) => {
              const active = condition === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.conditionCard, active && styles.conditionCardActive]}
                  onPress={() => setCondition(c.value)}
                >
                  <Text style={styles.conditionEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.conditionLabel, active && styles.conditionLabelActive]}>
                      {c.label}
                    </Text>
                    <Text style={styles.conditionDesc}>{c.desc}</Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </FormSection>

          {/* ── Pricing ───────────────────────────────────── */}
          <FormSection label="Pricing">
            <View style={styles.priceRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Price per day (NPR)"
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  error={errors.price_per_day}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Security deposit (NPR)"
                  value={securityDeposit}
                  onChangeText={setSecurityDeposit}
                  error={errors.security_deposit}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <Text style={styles.pricingNote}>
              Platform fee (8%) is deducted from payouts automatically.
            </Text>
          </FormSection>

          {/* ── Location ──────────────────────────────────── */}
          <FormSection label="Location">
            <Input
              label="Pickup location"
              value={pickupLocation}
              onChangeText={setPickupLocation}
              error={errors.pickup_location}
              returnKeyType="done"
            />
          </FormSection>

          {uploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading new photos…</Text>
            </View>
          )}

          <Button
            label="Save changes"
            onPress={() => { if (validate()) update.mutate(); }}
            loading={isSaving}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Category modal ────────────────────────────────── */}
      <Modal visible={categoryOpen} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryOpen(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
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
                  <Text style={[styles.modalItemText, active && styles.modalItemActive]}>
                    {item.name}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.modalSep} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  // ── Content ─────────────────────────────────────────────
  content: {
    padding: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  // ── Photos ──────────────────────────────────────────────
  imageRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  imageThumb: {
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
  primaryBadgeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: '#fff',
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(34,197,94,0.85)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  pendingBadgeText: {
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
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    backgroundColor: Colors.surfaceSecondary,
    gap: 4,
  },
  addPhotoLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },

  // ── Basic info / category ────────────────────────────────
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  fieldError: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  categoryBtnError: { borderColor: Colors.borderError },
  categoryPlaceholder: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
  categoryValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },

  // ── Condition ────────────────────────────────────────────
  conditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  conditionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  conditionEmoji: { fontSize: 22 },
  conditionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  conditionLabelActive: { color: Colors.primary },
  conditionDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  // ── Pricing ──────────────────────────────────────────────
  priceRow: { flexDirection: 'row', gap: Spacing.md },
  pricingNote: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    lineHeight: Typography.fontSize.xs * 1.6,
  },

  // ── Uploading ────────────────────────────────────────────
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  uploadingText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Category modal ───────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing.base,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.semiBold,
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
  modalItemActive: { fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },
  modalSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});
