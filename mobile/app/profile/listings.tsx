import React from 'react';
import {
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
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/product.service';
import ProductCard from '@/components/ui/ProductCard';
import EmptyState from '@/components/ui/EmptyState';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['products', 'my'],
    queryFn: () => productService.getMyListings(),
  });

  const products = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My listings</Text>
        <Pressable
          style={styles.newBtn}
          onPress={() => router.push('/listing/create')}
          hitSlop={4}
        >
          <Ionicons name="add" size={18} color={Colors.textInverse} />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>

      {/* ── List ───────────────────────────────────────────── */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, Shadow.sm]}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <ProductCard product={item} horizontal />
            <Pressable
              style={styles.editChip}
              onPress={() => router.push(`/listing/edit/${item.id}`)}
              hitSlop={4}
            >
              <Ionicons name="pencil-outline" size={13} color={Colors.primary} />
              <Text style={styles.editChipText}>Edit</Text>
            </Pressable>
          </Pressable>
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          products.length > 0 ? (
            <Text style={styles.count}>
              {products.length} listing{products.length !== 1 ? 's' : ''}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No listings yet"
              description="Share something you own with the Kathmandu community."
              actionLabel="Create first listing"
              onAction={() => router.push('/listing/create')}
            />
          ) : undefined
        }
      />
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
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
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  newBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textInverse,
  },

  // ── List ────────────────────────────────────────────────
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  count: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  sep: {
    height: Spacing.md,
  },

  // ── Card wrapper ─────────────────────────────────────────
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    margin: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  editChipText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
});
