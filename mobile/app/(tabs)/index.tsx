import React from 'react';
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { productService } from '@/services/product.service';
import { useAuthStore } from '@/store/auth.store';
import ProductCard from '@/components/ui/ProductCard';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import type { Product } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = React.useMemo(() => new Animated.Value(0.4), []);

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: '38%', height: 11 }]} />
        <View style={[styles.skeletonLine, { width: '88%', height: 14, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '55%', height: 13, marginTop: 5 }]} />
      </View>
    </Animated.View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── How it works step ─────────────────────────────────────────────────────────

function HowStep({
  icon,
  title,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.howTitle}>{title}</Text>
      <Text style={styles.howDesc}>{desc}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const { data: featured, isLoading: loadingFeatured, refetch, isRefetching } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => productService.listProducts({ page_size: 10 }),
  });

  const { data: newArrivals, isLoading: loadingNew } = useQuery({
    queryKey: ['products', 'new'],
    queryFn: () => productService.listProducts({ page_size: 8, ordering: '-created_at' }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.listCategories(),
  });

  const featuredProducts: Product[] = featured?.results ?? [];
  const newProducts: Product[] = newArrivals?.results ?? [];
  const firstName = user?.full_name.split(' ')[0] ?? 'there';

  return (
    <View style={styles.root}>

      {/* ── Fixed Header ───────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Image
          source={require('@/assets/logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push('/(tabs)/inbox')}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={21} color={Colors.textPrimary} />
          </Pressable>
          <Pressable
            style={styles.listBtn}
            onPress={() => router.push('/listing/create')}
          >
            <Ionicons name="add" size={16} color={Colors.textInverse} />
            <Text style={styles.listBtnText}>List item</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Scrollable Body ────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Greeting ───────────────────────────────────── */}
        <View style={styles.greeting}>
          <Text style={styles.greetingMain}>{getGreeting()}, {firstName}</Text>
          <Text style={styles.greetingSub}>Discover things to rent in Kathmandu</Text>
        </View>

        {/* ── Search bar ─────────────────────────────────── */}
        <Pressable
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/search')}
          accessibilityRole="search"
        >
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <Text style={styles.searchPlaceholder}>Cameras, bikes, tools…</Text>
        </Pressable>

        {/* ── Earn banner ────────────────────────────────── */}
        <Pressable
          style={styles.earnBanner}
          onPress={() => router.push('/listing/create')}
        >
          <View style={styles.earnText}>
            <Text style={styles.earnTitle}>Earn from your things</Text>
            <Text style={styles.earnSub}>List any item and start earning today</Text>
          </View>
          <View style={styles.earnIconWrap}>
            <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
          </View>
        </Pressable>

        {/* ── Categories ─────────────────────────────────── */}
        {categories && categories.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Browse categories"
              onSeeAll={() => router.push('/(tabs)/search')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScrollContent}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={styles.catChip}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/search', params: { category: String(cat.id) } })
                  }
                >
                  <Ionicons name="grid-outline" size={14} color={Colors.primary} />
                  <Text style={styles.catLabel}>{cat.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Featured picks ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Featured picks"
            onSeeAll={() => router.push('/(tabs)/search')}
          />
          {loadingFeatured ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productListContent}
              scrollEnabled={false}
            >
              <SkeletonCard /><View style={{ width: Spacing.md }} />
              <SkeletonCard /><View style={{ width: Spacing.md }} />
              <SkeletonCard />
            </ScrollView>
          ) : featuredProducts.length === 0 ? (
            <View style={styles.emptyBanner}>
              <Ionicons name="cube-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.emptyBannerText}>No listings yet — be the first!</Text>
              <Pressable
                style={styles.emptyBannerBtn}
                onPress={() => router.push('/listing/create')}
              >
                <Text style={styles.emptyBannerBtnText}>List an item</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ProductCard product={item} />}
              contentContainerStyle={styles.productListContent}
              ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
            />
          )}
        </View>

        {/* ── New arrivals ───────────────────────────────── */}
        {(loadingNew || newProducts.length > 0) && (
          <View style={styles.section}>
            <SectionHeader
              title="New arrivals"
              onSeeAll={() => router.push('/(tabs)/search')}
            />
            {loadingNew ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productListContent}
                scrollEnabled={false}
              >
                <SkeletonCard /><View style={{ width: Spacing.md }} />
                <SkeletonCard />
              </ScrollView>
            ) : (
              <FlatList
                data={newProducts}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ProductCard product={item} />}
                contentContainerStyle={styles.productListContent}
                ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
              />
            )}
          </View>
        )}

        {/* ── How it works ───────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="How it works" />
          <View style={[styles.howCard, Shadow.sm]}>
            <HowStep
              icon="search-outline"
              title="Discover"
              desc="Browse hundreds of items available nearby"
            />
            <View style={styles.howDivider} />
            <HowStep
              icon="calendar-outline"
              title="Book"
              desc="Pick dates, request, and pay securely"
            />
            <View style={styles.howDivider} />
            <HowStep
              icon="checkmark-circle-outline"
              title="Enjoy"
              desc="Pick up the item and return when done"
            />
          </View>
        </View>

        {/* ── Trust strip ────────────────────────────────── */}
        <View style={styles.trustStrip}>
          <TrustItem icon="shield-checkmark-outline" label="Verified users" />
          <TrustItem icon="lock-closed-outline" label="Secure payments" />
          <TrustItem icon="star-outline" label="Rated listings" />
        </View>
      </ScrollView>
    </View>
  );
}

function TrustItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_WIDTH = 210;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  headerLogo: {
    width: 124,
    height: 38,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  listBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textInverse,
  },

  // ── Scroll ────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: Spacing.lg,
    gap: Spacing['2xl'],
  },

  // ── Greeting ──────────────────────────────────────────────
  greeting: {
    paddingHorizontal: Spacing.base,
    gap: 4,
  },
  greetingMain: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  greetingSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },

  // ── Search bar ────────────────────────────────────────────
  searchBar: {
    marginHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },

  // ── Earn banner ───────────────────────────────────────────
  earnBanner: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  earnText: { flex: 1, gap: 2 },
  earnTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
  earnSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  earnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },

  // ── Section ───────────────────────────────────────────────
  section: { gap: Spacing.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // ── Categories ────────────────────────────────────────────
  catScrollContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Products ──────────────────────────────────────────────
  productListContent: {
    paddingHorizontal: Spacing.base,
  },

  // ── Empty banner ──────────────────────────────────────────
  emptyBanner: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyBannerText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  emptyBannerBtn: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  emptyBannerBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textInverse,
  },

  // ── How it works ──────────────────────────────────────────
  howCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  howStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
  },
  howIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  howDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.xs * 1.6,
  },
  howDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },

  // ── Trust strip ───────────────────────────────────────────
  trustStrip: {
    marginHorizontal: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  trustLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Skeleton ──────────────────────────────────────────────
  skeletonCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skeletonImage: {
    width: '100%',
    height: 155,
    backgroundColor: Colors.skeleton,
  },
  skeletonBody: {
    padding: Spacing.md,
  },
  skeletonLine: {
    backgroundColor: Colors.skeleton,
    borderRadius: Radius.xs,
  },
});
