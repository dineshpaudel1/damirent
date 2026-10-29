import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/product.service';
import ProductCard from '@/components/ui/ProductCard';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useDebounce } from '@/hooks/useDebounce';

// ── Sort options ──────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { label: 'Relevance', value: '' },
  { label: 'Price: Low to High', value: 'price_per_day' },
  { label: 'Price: High to Low', value: '-price_per_day' },
  { label: 'Newest first', value: '-created_at' },
  { label: 'Top rated', value: '-avg_rating' },
];

// ── Category icon map ─────────────────────────────────────────────────────────

const CAT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  electronics: 'phone-portrait-outline',
  camera: 'camera-outline',
  cameras: 'camera-outline',
  bike: 'bicycle-outline',
  bikes: 'bicycle-outline',
  bicycle: 'bicycle-outline',
  tool: 'construct-outline',
  tools: 'construct-outline',
  sports: 'basketball-outline',
  sport: 'basketball-outline',
  camping: 'bonfire-outline',
  vehicle: 'car-outline',
  vehicles: 'car-outline',
  furniture: 'bed-outline',
  book: 'book-outline',
  books: 'book-outline',
  clothing: 'shirt-outline',
  music: 'musical-notes-outline',
  gaming: 'game-controller-outline',
};

function catIcon(slug: string): keyof typeof Ionicons.glyphMap {
  const key = slug.toLowerCase();
  for (const [k, v] of Object.entries(CAT_ICON)) {
    if (key.includes(k)) return v;
  }
  return 'grid-outline';
}

// ── Sort sheet ────────────────────────────────────────────────────────────────

function SortSheet({
  visible,
  current,
  onSelect,
  onClose,
  bottomInset,
}: {
  visible: boolean;
  current: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  bottomInset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose} />
      <View style={[sheet.container, { paddingBottom: bottomInset + Spacing.lg }]}>
        <View style={sheet.handle} />
        <Text style={sheet.title}>Sort by</Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={sheet.option}
            onPress={() => { onSelect(opt.value); onClose(); }}
          >
            <Text style={[sheet.optionLabel, opt.value === current && sheet.optionLabelActive]}>
              {opt.label}
            </Text>
            {opt.value === current && (
              <Ionicons name="checkmark" size={18} color={Colors.primary} />
            )}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: 2,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  optionLabelActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory ?? '');
  const [sortValue, setSortValue] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

  const debouncedSearch = useDebounce(searchText, 400);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.listCategories(),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', 'search', debouncedSearch, selectedCategory, sortValue],
    queryFn: () =>
      productService.listProducts({
        search: debouncedSearch || undefined,
        category: selectedCategory || undefined,
        ordering: sortValue || undefined,
        page_size: 20,
      }),
  });

  const products = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const ALL_CATS = [{ id: 0, name: 'All', slug: '' }, ...(categories ?? [])];
  const hasFilters = !!(searchText || selectedCategory || sortValue);
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue);

  function clearAll() {
    setSearchText('');
    setSelectedCategory('');
    setSortValue('');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Sticky search area ──────────────────────────── */}
      <View style={styles.searchArea}>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cameras, bikes, tools…"
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} hitSlop={10}>
                <View style={styles.clearBtn}>
                  <Ionicons name="close" size={12} color={Colors.textTertiary} />
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catList}
        >
          {ALL_CATS.map((item) => {
            const isActive =
              item.slug === '' ? !selectedCategory : String(item.id) === selectedCategory;
            const icon: keyof typeof Ionicons.glyphMap =
              item.slug === '' ? 'apps-outline' : catIcon(item.slug);
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedCategory(item.slug === '' ? '' : String(item.id))}
              >
                <Ionicons
                  name={icon}
                  size={13}
                  color={isActive ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Results ─────────────────────────────────────── */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard product={item} horizontal />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.resultsBar}>
            {/* Count / status */}
            <View style={styles.resultsLeft}>
              {isFetching ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : null}
              <Text style={styles.resultCount}>
                {isFetching
                  ? 'Searching…'
                  : `${totalCount} result${totalCount !== 1 ? 's' : ''}`}
              </Text>
            </View>

            {/* Controls */}
            <View style={styles.resultsRight}>
              {hasFilters && (
                <Pressable style={styles.clearAllBtn} onPress={clearAll} hitSlop={8}>
                  <Ionicons name="close-circle" size={13} color={Colors.error} />
                  <Text style={styles.clearAllText}>Clear</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.sortBtn, sortValue && styles.sortBtnActive]}
                onPress={() => setSortOpen(true)}
                hitSlop={8}
              >
                <Ionicons
                  name="swap-vertical-outline"
                  size={14}
                  color={sortValue ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.sortBtnText, sortValue && styles.sortBtnTextActive]}>
                  {sortValue ? activeSort?.label : 'Sort'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading && !isFetching ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={36} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySub}>
                {searchText
                  ? `No items matching "${searchText}". Try different keywords.`
                  : 'No items in this category yet. Try another one.'}
              </Text>
              {hasFilters && (
                <Pressable style={styles.emptyAction} onPress={clearAll}>
                  <Text style={styles.emptyActionText}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          ) : isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : undefined
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />

      {/* ── Sort sheet ──────────────────────────────────── */}
      <SortSheet
        visible={sortOpen}
        current={sortValue}
        onSelect={setSortValue}
        onClose={() => setSortOpen(false)}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Search area ──────────────────────────────────────────
  searchArea: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    ...Shadow.sm,
  },
  searchRow: {
    paddingHorizontal: Spacing.base,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Category chips ───────────────────────────────────────
  catList: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: '#fff',
  },

  // ── Results bar ──────────────────────────────────────────
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  resultsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resultCount: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  resultsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorSurface,
  },
  clearAllText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary + '55',
  },
  sortBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  sortBtnTextActive: {
    color: Colors.primary,
  },

  // ── Loading ──────────────────────────────────────────────
  loadingWrap: {
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
  },

  // ── Empty ────────────────────────────────────────────────
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
  emptyAction: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  emptyActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: '#fff',
  },
});
