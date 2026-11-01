/**
 * Admin dashboard — accessible only to staff users (is_staff = true).
 * All actual authorization is enforced on the backend; this screen is a
 * UI convenience only.
 */
import React, { useState } from 'react';
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
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { productService } from '@/services/product.service';
import { useAuthStore } from '@/store/auth.store';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { AdminUser, Category, VerificationRequest, VerificationStatus } from '@/types';

// ── Document image ─────────────────────────────────────────────────────────

function DocImage({ userId, side }: { userId: string; side: 'front' | 'back' }) {
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
    <Image source={source} style={docStyles.image} resizeMode="contain" onError={() => setErrored(true)} />
  );
}

const docStyles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary },
});

// ── Rejection modal ────────────────────────────────────────────────────────

function RejectModal({
  visible, onCancel, onConfirm, loading,
}: { visible: boolean; onCancel: () => void; onConfirm: (r: string) => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Reject verification</Text>
          <Text style={modalStyles.subtitle}>Provide a reason so the user knows what to correct.</Text>
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
              onPress={() => {
                const t = reason.trim();
                if (!t) { Alert.alert('Required', 'Please provide a rejection reason.'); return; }
                onConfirm(t);
              }}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Text style={modalStyles.rejectText}>Reject</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  sheet: { width: '100%', backgroundColor: Colors.surface, borderRadius: Radius['2xl'], padding: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, color: Colors.textPrimary },
  subtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.base, color: Colors.textPrimary, minHeight: 80 },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  rejectBtn: { flex: 1, height: 48, borderRadius: Radius.md, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  rejectText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textInverse },
});

// ── Verification card ──────────────────────────────────────────────────────

function VerificationCard({
  item, onApprove, onReject, approving,
}: { item: VerificationRequest; onApprove: () => void; onReject: () => void; approving: boolean }) {
  const [docVisible, setDocVisible] = useState(false);
  return (
    <View style={[styles.card, Shadow.sm]}>
      <View style={styles.userRow}>
        {item.user.avatar
          ? <Image source={{ uri: item.user.avatar }} style={styles.userAvatar} />
          : <View style={styles.userAvatarCircle}><Text style={styles.userAvatarInitial}>{item.user.full_name.charAt(0).toUpperCase()}</Text></View>
        }
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user.full_name}</Text>
          <Text style={styles.userEmail}>{item.user.email}</Text>
          {item.submitted_at && (
            <Text style={styles.submittedAt}>Submitted {new Date(item.submitted_at).toLocaleDateString()}</Text>
          )}
        </View>
      </View>

      <Pressable style={styles.docsToggle} onPress={() => setDocVisible((v) => !v)}>
        <Ionicons name={docVisible ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.primary} />
        <Text style={styles.docsToggleText}>{docVisible ? 'Hide documents' : 'View documents'}</Text>
      </Pressable>

      {docVisible && (
        <View style={styles.docsRow}>
          <View style={styles.docWrapper}>
            <Text style={styles.docLabel}>Front side</Text>
            <View style={styles.docImageBox}><DocImage userId={item.user.id} side="front" /></View>
          </View>
          <View style={styles.docWrapper}>
            <Text style={styles.docLabel}>Back side</Text>
            <View style={styles.docImageBox}><DocImage userId={item.user.id} side="back" /></View>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.rejectBtn, approving && { opacity: 0.5 }]} onPress={onReject} disabled={approving}>
          <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.rejectBtnText}>Reject</Text>
        </Pressable>
        <Pressable style={[styles.approveBtn, approving && { opacity: 0.6 }]} onPress={onApprove} disabled={approving}>
          {approving
            ? <ActivityIndicator size="small" color={Colors.textInverse} />
            : <><Ionicons name="checkmark-circle-outline" size={16} color={Colors.textInverse} /><Text style={styles.approveBtnText}>Approve</Text></>
          }
        </Pressable>
      </View>
    </View>
  );
}

// ── Verification Status Badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { label: string; color: string; bg: string }> = {
    not_submitted: { label: 'Not submitted', color: Colors.textTertiary, bg: Colors.surfaceSecondary },
    pending: { label: 'Pending', color: Colors.warning, bg: Colors.warningSurface },
    verified: { label: 'Verified', color: Colors.success, bg: Colors.successSurface },
    rejected: { label: 'Rejected', color: Colors.error, bg: Colors.errorSurface },
  };
  const cfg = map[status];
  return (
    <View style={[userCardStyles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[userCardStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ── User management card ───────────────────────────────────────────────────

function UserCard({
  item, onToggleStaff, toggling,
}: { item: AdminUser; onToggleStaff: () => void; toggling: boolean }) {
  return (
    <View style={[styles.card, Shadow.sm]}>
      <View style={styles.userRow}>
        {item.avatar
          ? <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
          : <View style={styles.userAvatarCircle}><Text style={styles.userAvatarInitial}>{item.full_name.charAt(0).toUpperCase()}</Text></View>
        }
        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.userName}>{item.full_name}</Text>
            {item.is_staff && (
              <View style={userCardStyles.staffPill}>
                <Text style={userCardStyles.staffPillText}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.submittedAt}>Joined {new Date(item.date_joined).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={userCardStyles.footer}>
        <StatusBadge status={item.verification_status} />
        <Pressable
          style={[userCardStyles.staffBtn, item.is_staff && userCardStyles.staffBtnActive, toggling && { opacity: 0.6 }]}
          onPress={onToggleStaff}
          disabled={toggling}
        >
          {toggling
            ? <ActivityIndicator size="small" color={item.is_staff ? Colors.textInverse : Colors.primary} />
            : <>
              <Ionicons
                name={item.is_staff ? 'shield-checkmark' : 'shield-outline'}
                size={14}
                color={item.is_staff ? Colors.textInverse : Colors.primary}
              />
              <Text style={[userCardStyles.staffBtnText, item.is_staff && userCardStyles.staffBtnTextActive]}>
                {item.is_staff ? 'Revoke admin' : 'Make admin'}
              </Text>
            </>
          }
        </Pressable>
      </View>
    </View>
  );
}

const userCardStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  staffBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary },
  staffBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  staffBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.xs, color: Colors.primary },
  staffBtnTextActive: { color: Colors.textInverse },
  staffPill: { backgroundColor: Colors.primarySurface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  staffPillText: { fontFamily: Typography.fontFamily.bold, fontSize: 9, color: Colors.primary, letterSpacing: 0.5 },
});

// ── Verification tab ───────────────────────────────────────────────────────

function VerificationTab() {
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
      Alert.alert('Approved', 'Verification has been approved.');
    },
    onError: () => Alert.alert('Error', 'Could not approve. Please try again.'),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      authService.rejectVerification(userId, reason),
    onSuccess: () => {
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['verification-pending'] });
      Alert.alert('Rejected', 'Verification has been rejected.');
    },
    onError: () => Alert.alert('Error', 'Could not reject. Please try again.'),
  });

  if (isLoading) return <View style={styles.centred}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (error) return (
    <View style={styles.centred}>
      <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
      <Text style={styles.errorText}>Could not load pending submissions.</Text>
    </View>
  );

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
      >
        <View style={[styles.summaryCard, Shadow.sm]}>
          <Ionicons name="people-outline" size={20} color={Colors.primary} />
          <Text style={styles.summaryText}>
            {(pending?.length ?? 0) === 0
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

        {(pending?.length ?? 0) === 0 && (
          <View style={[styles.centred, { paddingVertical: Spacing['3xl'] }]}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.success} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>No identity verification requests are pending.</Text>
          </View>
        )}
      </ScrollView>

      <RejectModal
        visible={rejectTarget !== null}
        loading={reject.isPending}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (rejectTarget) reject.mutate({ userId: rejectTarget, reason });
        }}
      />
    </>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', debouncedSearch],
    queryFn: () => authService.getAdminUsers(debouncedSearch || undefined),
    retry: false,
  });

  const toggleStaff = useMutation({
    mutationFn: (userId: string) => authService.toggleStaff(userId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      Alert.alert('Updated', res.message);
    },
    onError: () => Alert.alert('Error', 'Could not update staff status.'),
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={usersTabStyles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
        <TextInput
          style={usersTabStyles.searchInput}
          placeholder="Search by name or email…"
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {isLoading && <View style={styles.centred}><ActivityIndicator size="large" color={Colors.primary} /></View>}
      {error && !isLoading && (
        <View style={styles.centred}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          <Text style={styles.errorText}>Could not load users.</Text>
        </View>
      )}

      {!isLoading && !error && (
        <FlatList
          data={data?.results ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          ListHeaderComponent={
            data ? (
              <Text style={usersTabStyles.count}>{data.count} user{data.count !== 1 ? 's' : ''}</Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <UserCard
              item={item}
              onToggleStaff={() => {
                Alert.alert(
                  item.is_staff ? 'Revoke admin access?' : 'Grant admin access?',
                  `This will ${item.is_staff ? 'remove' : 'grant'} staff privileges for ${item.full_name}.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', style: item.is_staff ? 'destructive' : 'default', onPress: () => toggleStaff.mutate(item.id) },
                  ],
                );
              }}
              toggling={toggleStaff.isPending && toggleStaff.variables === item.id}
            />
          )}
          ListEmptyComponent={
            <View style={[styles.centred, { paddingVertical: Spacing['3xl'] }]}>
              <Ionicons name="people-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const usersTabStyles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  count: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
});

// ── Category form modal ────────────────────────────────────────────────────

interface CategoryFormValues {
  name: string;
  icon_name: string;
  sort_order: string;
}

function CategoryFormModal({
  visible,
  initial,
  onCancel,
  onSave,
  saving,
}: {
  visible: boolean;
  initial: Category | null;
  onCancel: () => void;
  onSave: (values: CategoryFormValues) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [iconName, setIconName] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setIconName(initial?.icon_name ?? '');
      setSortOrder(initial ? String(initial.sort_order) : '0');
    }
  }, [visible, initial]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Category name is required.');
      return;
    }
    onSave({ name: name.trim(), icon_name: iconName.trim(), sort_order: sortOrder });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={catModalStyles.overlay}>
          <View style={catModalStyles.sheet}>
            <Text style={catModalStyles.title}>
              {initial ? 'Edit category' : 'New category'}
            </Text>

            <View style={catModalStyles.field}>
              <Text style={catModalStyles.label}>Name *</Text>
              <TextInput
                style={catModalStyles.input}
                placeholder="e.g. Electronics"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
                editable={!saving}
              />
            </View>

            <View style={catModalStyles.field}>
              <Text style={catModalStyles.label}>Icon name</Text>
              <TextInput
                style={catModalStyles.input}
                placeholder="e.g. car-outline, bicycle-outline"
                placeholderTextColor={Colors.textTertiary}
                value={iconName}
                onChangeText={setIconName}
                autoCapitalize="none"
                editable={!saving}
              />
              <Text style={catModalStyles.hint}>Ionicons icon name (optional)</Text>
            </View>

            <View style={catModalStyles.field}>
              <Text style={catModalStyles.label}>Sort order</Text>
              <TextInput
                style={catModalStyles.input}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="number-pad"
                editable={!saving}
              />
              <Text style={catModalStyles.hint}>Lower numbers appear first</Text>
            </View>

            <View style={catModalStyles.actions}>
              <Pressable style={catModalStyles.cancelBtn} onPress={onCancel} disabled={saving}>
                <Text style={catModalStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[catModalStyles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={Colors.textInverse} />
                  : <Text style={catModalStyles.saveText}>{initial ? 'Save changes' : 'Create'}</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const catModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: Spacing['3xl'],
  },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.textPrimary },
  field: { gap: 4 },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  hint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  saveBtn: { flex: 1, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textInverse },
});

// ── Category card ──────────────────────────────────────────────────────────

function CategoryCard({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: Category;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const iconName = (item.icon_name || 'grid-outline') as React.ComponentProps<typeof Ionicons>['name'];
  return (
    <View style={[styles.card, Shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
        <View style={catStyles.iconCircle}>
          <Ionicons name={iconName} size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>/{item.slug}</Text>
          {item.children.length > 0 && (
            <Text style={styles.submittedAt}>{item.children.length} sub-categor{item.children.length === 1 ? 'y' : 'ies'}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable
            style={catStyles.iconBtn}
            onPress={onEdit}
            hitSlop={8}
            disabled={deleting}
          >
            <Ionicons name="pencil-outline" size={17} color={Colors.primary} />
          </Pressable>
          <Pressable
            style={[catStyles.iconBtn, catStyles.deleteBtn]}
            onPress={onDelete}
            hitSlop={8}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <Ionicons name="trash-outline" size={17} color={Colors.error} />
            }
          </Pressable>
        </View>
      </View>

      {item.children.length > 0 && (
        <View style={catStyles.childrenWrap}>
          {item.children.map((child) => (
            <View key={child.id} style={catStyles.childPill}>
              <Text style={catStyles.childPillText}>{child.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const catStyles = StyleSheet.create({
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { borderColor: Colors.error + '44' },
  childrenWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  childPill: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  childPillText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
});

// ── Categories tab ─────────────────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: productService.listCategories,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      productService.createCategory({
        name: values.name,
        icon_name: values.icon_name || undefined,
        sort_order: values.sort_order ? parseInt(values.sort_order, 10) : 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFormVisible(false);
      Alert.alert('Created', 'Category has been created.');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.slug?.[0] ?? e?.response?.data?.error ?? 'Could not create category.';
      Alert.alert('Error', msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryFormValues }) =>
      productService.updateCategory(id, {
        name: values.name,
        icon_name: values.icon_name || undefined,
        sort_order: values.sort_order ? parseInt(values.sort_order, 10) : 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFormVisible(false);
      setEditTarget(null);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.slug?.[0] ?? e?.response?.data?.error ?? 'Could not update category.';
      Alert.alert('Error', msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? 'Could not delete category.';
      Alert.alert('Error', msg);
    },
  });

  const handleSave = (values: CategoryFormValues) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleDelete = (item: Category) => {
    Alert.alert(
      'Delete category?',
      `"${item.name}" will be permanently removed. This cannot be undone if it has no products.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(item.id),
        },
      ],
    );
  };

  if (isLoading) return <View style={styles.centred}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (error) return (
    <View style={styles.centred}>
      <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
      <Text style={styles.errorText}>Could not load categories.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={categories ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListHeaderComponent={
          <Text style={usersTabStyles.count}>
            {(categories?.length ?? 0)} categor{(categories?.length ?? 0) !== 1 ? 'ies' : 'y'}
          </Text>
        }
        renderItem={({ item }) => (
          <CategoryCard
            item={item}
            onEdit={() => { setEditTarget(item); setFormVisible(true); }}
            onDelete={() => handleDelete(item)}
            deleting={deleteMutation.isPending && deleteMutation.variables === item.id}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.centred, { paddingVertical: Spacing['3xl'] }]}>
            <Ionicons name="grid-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add the first category.</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        style={catTabStyles.fab}
        onPress={() => { setEditTarget(null); setFormVisible(true); }}
      >
        <Ionicons name="add" size={28} color={Colors.textInverse} />
      </Pressable>

      <CategoryFormModal
        visible={formVisible}
        initial={editTarget}
        saving={createMutation.isPending || updateMutation.isPending}
        onCancel={() => { setFormVisible(false); setEditTarget(null); }}
        onSave={handleSave}
      />
    </View>
  );
}

const catTabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Spacing['3xl'],
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

type Tab = 'verification' | 'users' | 'categories';

export default function AdminDashboardScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('verification');

  if (!user?.is_staff) {
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
        <Text style={styles.headerTitle}>Admin dashboard</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === 'verification' && styles.tabItemActive]}
          onPress={() => setActiveTab('verification')}
        >
          <Ionicons
            name="shield-outline"
            size={16}
            color={activeTab === 'verification' ? Colors.primary : Colors.textTertiary}
          />
          <Text style={[styles.tabLabel, activeTab === 'verification' && styles.tabLabelActive]}>
            Verify
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === 'users' && styles.tabItemActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'users' ? Colors.primary : Colors.textTertiary}
          />
          <Text style={[styles.tabLabel, activeTab === 'users' && styles.tabLabelActive]}>
            Users
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === 'categories' && styles.tabItemActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={activeTab === 'categories' ? Colors.primary : Colors.textTertiary}
          />
          <Text style={[styles.tabLabel, activeTab === 'categories' && styles.tabLabelActive]}>
            Categories
          </Text>
        </Pressable>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'verification' && <VerificationTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'categories' && <CategoriesTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  forbiddenText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg, color: Colors.textTertiary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg, color: Colors.textPrimary },
  headerRight: { width: 36 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textTertiary },
  tabLabelActive: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold },

  tabContent: { padding: Spacing.base, gap: Spacing.md },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base },
  summaryText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.base, color: Colors.textPrimary },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, gap: Spacing.md },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userAvatar: { width: 48, height: 48, borderRadius: 24 },
  userAvatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  userAvatarInitial: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.primary },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  userEmail: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  submittedAt: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary },

  docsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.xs },
  docsToggleText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  docsRow: { flexDirection: 'row', gap: Spacing.sm },
  docWrapper: { flex: 1, gap: Spacing.xs },
  docLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  docImageBox: { height: 160, borderRadius: Radius.lg, backgroundColor: Colors.surfaceSecondary, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },

  actions: { flexDirection: 'row', gap: Spacing.md },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.error + '55', backgroundColor: Colors.errorSurface },
  rejectBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.error },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: Radius.md, backgroundColor: Colors.success },
  approveBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.base, color: Colors.textInverse },

  emptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.textPrimary },
  emptySubtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.base, color: Colors.textSecondary, textAlign: 'center' },
});
