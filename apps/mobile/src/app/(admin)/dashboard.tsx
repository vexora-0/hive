import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing, radius, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { SkeletonShimmer } from '@/components/feedback/SkeletonShimmer';
import { EmptyState } from '@/components/feedback';
import { Reveal } from '@/components/animation';
import { StatCard } from '@/features/admin/components/StatCard';
import { useAdminDashboard } from '@/features/admin/hooks/useAdminDashboard';

// ---------------------------------------------------------------------------
// Stat card configuration
// ---------------------------------------------------------------------------

const STAT_CARDS = [
  {
    key: 'schools',
    icon: 'business-outline' as const,
    label: 'Schools',
    color: colors.text.accent,
    wash: colors.primary.amberWash,
    field: 'schools' as const,
  },
  {
    key: 'users',
    icon: 'people-outline' as const,
    label: 'People',
    color: colors.primary.blueDark,
    wash: colors.primary.blueWash,
    field: 'users' as const,
  },
  {
    key: 'photos',
    icon: 'images-outline' as const,
    label: 'Photos shared',
    color: colors.primary.mintDark,
    wash: colors.primary.mintWash,
    field: 'photos' as const,
  },
  {
    key: 'orders',
    icon: 'bag-handle-outline' as const,
    label: 'Orders',
    color: colors.primary.lavenderDark,
    wash: colors.primary.lavenderWash,
    field: 'orders' as const,
  },
  {
    // The API returns this in integer paise, like every other money value.
    // It used to be printed raw behind a dollar sign, so ₹499 of orders
    // displayed as "$49900".
    key: 'revenue',
    icon: 'cash-outline' as const,
    label: 'Revenue',
    color: colors.success.dark,
    wash: colors.success.background,
    field: 'revenue' as const,
    format: 'rupees' as const,
  },
  {
    key: 'activeToday',
    icon: 'pulse-outline' as const,
    label: 'Active today',
    color: colors.primary.roseDark,
    wash: colors.primary.roseWash,
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
          <SkeletonShimmer width="100%" height={124} borderRadius={radius.lg} index={i} />
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
  const { stats, isLoading, isError, isRefetching, refetch } = useAdminDashboard();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Overview" eyebrow="Across every school" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary.amberDark}
            colors={[colors.primary.amberDark]}
            progressBackgroundColor={colors.background.surface}
          />
        }
      >
        {isLoading ? (
          <DashboardSkeleton />
        ) : isError ? (
          // Falling through to `?? 0` here printed "Schools 0 / Users 0 /
          // Revenue £0" on a failed request, which reads as real data rather
          // than a failure to fetch it.
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load statistics"
            message="Check your connection and try again."
            action={{ label: 'Try again', onPress: onRefresh }}
          />
        ) : (
          <View style={styles.grid}>
            {STAT_CARDS.map((card, index) => (
              <Reveal key={card.key} index={index} style={styles.gridItem}>
                <StatCard
                  icon={card.icon}
                  label={card.label}
                  value={stats?.[card.field] ?? 0}
                  color={card.color}
                  wash={card.wash}
                  format={'format' in card ? card.format : undefined}
                />
              </Reveal>
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: layout.tabBarClearance,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.ms,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: '45%',
  },
});
