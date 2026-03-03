import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { SkeletonShimmer } from '@/components/feedback/SkeletonShimmer';
import { StatCard } from '@/features/admin/components/StatCard';
import { useAdminDashboard } from '@/features/admin/hooks/useAdminDashboard';

// ---------------------------------------------------------------------------
// Stat card configuration
// ---------------------------------------------------------------------------

const STAT_CARDS = [
  {
    key: 'schools',
    icon: 'school-outline' as const,
    label: 'Schools',
    color: colors.primary.amber,
    field: 'schools' as const,
  },
  {
    key: 'users',
    icon: 'people-outline' as const,
    label: 'Users',
    color: colors.primary.blue,
    field: 'users' as const,
  },
  {
    key: 'photos',
    icon: 'camera-outline' as const,
    label: 'Photos',
    color: colors.primary.mint,
    field: 'photos' as const,
  },
  {
    key: 'orders',
    icon: 'cart-outline' as const,
    label: 'Orders',
    color: colors.primary.lavender,
    field: 'orders' as const,
  },
  {
    key: 'revenue',
    icon: 'cash-outline' as const,
    label: 'Revenue',
    color: colors.success.main,
    field: 'revenue' as const,
    prefix: '$',
  },
  {
    key: 'activeToday',
    icon: 'pulse-outline' as const,
    label: 'Active Today',
    color: colors.primary.blueDark,
    field: 'activeToday' as const,
  },
] as const;

// ---------------------------------------------------------------------------
// Skeleton placeholder
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <SkeletonShimmer width="100%" height={120} borderRadius={16} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Admin dashboard screen showing a 2-column grid of stat cards.
 *
 * Features pull-to-refresh and a skeleton loading state on initial load.
 */
export default function DashboardScreen() {
  const { stats, isLoading, isRefetching, refetch } = useAdminDashboard();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Admin Dashboard" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary.amber}
            colors={[colors.primary.amber]}
          />
        }
      >
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <View style={styles.grid}>
            {STAT_CARDS.map((card) => (
              <View key={card.key} style={styles.gridItem}>
                <StatCard
                  icon={card.icon}
                  label={card.label}
                  value={stats?.[card.field] ?? 0}
                  color={card.color}
                  prefix={'prefix' in card ? card.prefix : undefined}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48.5%',
  },
});
