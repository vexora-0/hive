import React, { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import {
  colors,
  play,
  spacing,
  radius,
  layout,
  duration as motionDuration,
  tracking,
} from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PlayfulBackdrop } from '@/components/decor';
import { HeaderBar, useHeaderScroll } from '@/components/navigation';
import { Text, Card, Divider, Button, SectionHeader } from '@/components/ui';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { Reveal, AnimatedCounter } from '@/components/animation';
import { StatRow } from '@/features/admin/components/StatRow';
import { useAdminDashboard } from '@/features/admin/hooks/useAdminDashboard';
import { useAdminOrders } from '@/features/admin/hooks/useAdminOrders';
import { formatRupees } from '@/features/orders/constants/products';

// ---------------------------------------------------------------------------
// Today
//
// `DashboardStats` is five all-time totals. There is no "photos uploaded
// today", no "orders pending", no "parents joined this week" — and
// `activeToday` is not a statistic at all: `adminService.getDashboardStats`
// hard-codes it to `0` because the endpoint never returned it, so the old
// dashboard printed "Active today 0" for ever.
//
// Rather than dress a total up as a day, today's figure is *derived* from data
// the app already holds: the fulfilment queue is ordered newest-first, so every
// order placed today sits at the head of its first page. Counting them there is
// exact for any preschool that takes fewer than a page of orders in a day, and
// the one case where it is not — a full page, all of it today — is stated as
// "20+" rather than guessed at. React Query serves it from the same cache entry
// the Orders tab uses, so leading with it costs no extra request.
// ---------------------------------------------------------------------------

function isToday(iso: string): boolean {
  const then = new Date(iso);
  const now = new Date();
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  );
}

/** Today's date, written the way a person says it. Never a machine stamp. */
function todayLine(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ---------------------------------------------------------------------------
// Skeleton
//
// Shaped like what it replaces — one tall card, then a grouped list of three
// rows — so nothing moves when the numbers land. `SkeletonShimmer` serves the
// 200ms delay itself, so a warm cache renders straight to content.
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <View>
      <SkeletonShimmer width="100%" height={196} borderRadius={radius.lg} />

      {/* The section header sits between the two cards in the loaded state, so
          it is here too — a skeleton that skips it lets everything below jump
          up by its height the moment the data lands. */}
      <View style={styles.skeletonHeader}>
        <SkeletonShimmer width={128} height={22} borderRadius={radius.xs} index={1} />
      </View>

      {/* 165 = two 56pt rows, two hairlines, the 49pt closing line, and the
          card's own border. */}
      <SkeletonShimmer width="100%" height={165} borderRadius={radius.lg} index={2} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * The admin overview — a companion, not a console.
 *
 * What this screen used to be: six numbers in a 2-column grid, each in a tile
 * of its own hue, none of them leading anywhere, one of them permanently zero.
 * Nothing on it could be acted on, so an admin read it once and never again.
 *
 * What it is now, in order of what an administrator can actually do from a
 * phone:
 *
 *  1. **Today**, and the one queue with work in it. Orders are the only thing
 *     on this screen that has a next step, so today's count leads and the
 *     screen's single primary action opens the queue underneath it.
 *  2. **The roster**, as two quiet rows in one card. Schools and people lead
 *     somewhere an admin can change something, so both are rows with a chevron
 *     and both are built the same way. Photographs shared leads nowhere — there
 *     is no admin photo screen — so it is not a row at all: it is the card's
 *     closing line, in the same quiet voice the Today card signs off in. A
 *     third row that looked identical to the two above it but did not respond
 *     to a tap read as a broken row rather than as a deliberate statistic.
 *
 * Deliberately *not* here: anything that belongs at a desk. There is no report
 * export, no chart, no date-range picker and no per-school breakdown — Linear's
 * rule that mobile is for away-from-keyboard work, applied by leaving things
 * out rather than by shrinking them.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { scrollY, onScroll } = useHeaderScroll();

  const { stats, isLoading, isError, isRefetching, refetch } = useAdminDashboard();
  const {
    orders,
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    hasNextPage: hasMoreOrders,
    refetch: refetchOrders,
  } = useAdminOrders();

  const today = useMemo(() => {
    const count = orders.filter((order) => isToday(order.created_at)).length;
    // Only ambiguous when the whole page is today's — otherwise the page holds
    // every one of them and the count is exact.
    const capped = hasMoreOrders && count === orders.length && count > 0;
    return { count, capped };
  }, [orders, hasMoreOrders]);

  /** The roster card's closing line. Reads as a sentence at any count. */
  const photographLine = useMemo(() => {
    const count = stats?.photos ?? 0;
    if (count === 0) return 'No photographs shared yet';
    return `${count} ${count === 1 ? 'photograph' : 'photographs'} shared in all`;
  }, [stats?.photos]);

  const onRefresh = useCallback(() => {
    refetch();
    refetchOrders();
  }, [refetch, refetchOrders]);

  const openOrders = useCallback(() => {
    router.push('/(admin)/orders' as never);
  }, [router]);

  const openSchools = useCallback(() => {
    router.push('/(admin)/schools' as never);
  }, [router]);

  const openPeople = useCallback(() => {
    router.push('/(admin)/users' as never);
  }, [router]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Plum, the admin's colour. Kept to `page` — an administrator is at
          work, and the console gets the atmosphere without the pollen. */}
      <PlayfulBackdrop level="page" tint={play.grape.base} />

      <HeaderBar
        large
        play
        translucent
        mascot="idle"
        title="Overview"
        eyebrow="Across every school"
        scrollY={scrollY}
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
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
        {isLoading || isLoadingOrders ? (
          <DashboardSkeleton />
        ) : isError || isOrdersError ? (
          // Falling through to `?? 0` printed "Schools 0 · People 0 · ₹0" on a
          // failed request, which reads as real data rather than as a failure
          // to fetch it.
          //
          // Both queries are in this branch because both feed the headline: if
          // the queue cannot be fetched, "0 prints ordered" is a claim about a
          // school day that was never actually asked about.
          <EmptyState
            variant="error"
            title="Couldn't load the overview."
            message="Check your connection and try again."
            action={{ label: 'Try again', onPress: onRefresh }}
          />
        ) : (
          <>
            {/* ── Today ─────────────────────────────────────────── */}
            <Reveal>
              <Card elevation="raised" padding={0} style={styles.todayCard}>
                <View style={styles.todayBody}>
                  <Text variant="eyebrow" color={colors.text.tertiary}>
                    Today
                  </Text>

                  <View
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={
                      today.count === 0
                        ? 'No prints ordered today'
                        : `${today.count}${today.capped ? ' or more' : ''} prints ordered today`
                    }
                    style={styles.todayFigure}
                  >
                    <AnimatedCounter
                      value={today.count}
                      suffix={today.capped ? '+' : ''}
                      duration={motionDuration.slow}
                      style={styles.todayCounter}
                    />
                    <Text variant="h4" style={styles.todayUnit}>
                      {today.count === 1 ? 'print ordered' : 'prints ordered'}
                    </Text>
                  </View>

                  {/* The one editorial line this screen is allowed. */}
                  <Text variant="editorial" muted style={styles.todayDate}>
                    {todayLine()}
                  </Text>
                </View>

                <Divider inset={spacing.md} />

                <View style={styles.todayFoot}>
                  <Text variant="bodySmall" muted>
                    {stats?.orders ?? 0} orders in all, worth{' '}
                    {formatRupees(stats?.revenue ?? 0)}
                  </Text>

                  {/* The screen's one persistent primary action. An admin can
                      read anything on this page; the queue is the only place
                      they can move something on. */}
                  <Button
                    fullWidth
                    onPress={openOrders}
                    style={styles.todayAction}
                    accessibilityHint="Opens the fulfilment queue"
                  >
                    Open the queue
                  </Button>
                </View>
              </Card>
            </Reveal>

            {/* ── The roster ────────────────────────────────────── */}
            <Reveal index={1} style={styles.rosterHeader}>
              <SectionHeader title="The roster" />
            </Reveal>

            <Reveal index={2}>
              <Card elevation="low" padding={0}>
                {/* Both rows are built identically — icon, label, count,
                    chevron — because both do the same thing. The caption that
                    used to hang under "People" made one row taller than the
                    other for no reason a reader could see. */}
                <StatRow
                  icon="school-outline"
                  label="Schools"
                  value={stats?.schools ?? 0}
                  onPress={openSchools}
                  accessibilityHint="Opens the list of schools"
                />
                <Divider inset={spacing.md} />
                <StatRow
                  icon="people-outline"
                  label="People"
                  value={stats?.users ?? 0}
                  onPress={openPeople}
                  accessibilityHint="Opens the list of people"
                />

                <Divider inset={spacing.md} />

                {/* Context, not a destination. */}
                <View style={styles.rosterFoot}>
                  <Text variant="bodySmall" muted>
                    {photographLine}
                  </Text>
                </View>
              </Card>
            </Reveal>
          </>
        )}
      </Animated.ScrollView>
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
  skeletonHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.ms,
    height: 28,
    justifyContent: 'center',
  },
  todayCard: {
    overflow: 'hidden',
  },
  todayBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  todayFigure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  todayCounter: {
    fontSize: 40,
    letterSpacing: tracking.display,
  },
  todayUnit: {
    color: colors.text.secondary,
  },
  todayDate: {
    marginTop: spacing.xs,
  },
  todayFoot: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.ms,
    paddingBottom: spacing.md,
  },
  todayAction: {
    marginTop: spacing.ms,
  },
  rosterHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.ms,
  },
  /** Same measures as `todayFoot`, so both cards sign off identically. */
  rosterFoot: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.ms,
    paddingBottom: spacing.md,
  },
});
