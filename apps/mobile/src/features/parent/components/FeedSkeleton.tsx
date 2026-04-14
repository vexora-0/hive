import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { SkeletonShimmer } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = spacing.sm;
const HORIZONTAL_PADDING = spacing.md * 2;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING - COLUMN_GAP) / 2;

/** Heights that mimic the PolaroidCard aspect ratio + caption area. */
const CARD_HEIGHTS = [CARD_WIDTH + 40, CARD_WIDTH + 56, CARD_WIDTH + 32, CARD_WIDTH + 48, CARD_WIDTH + 40, CARD_WIDTH + 52];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<FeedSkeleton>` -- a skeleton loading state that mimics the masonry
 * grid of PolaroidCards. Shows 6 shimmer cards in a two-column layout.
 *
 * ```tsx
 * {isLoading && <FeedSkeleton />}
 * ```
 */
export function FeedSkeleton() {
  return (
    <View style={styles.container}>
      {/* Child switcher skeleton */}
      <View style={styles.switcherRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={`avatar-${i}`} style={styles.avatarContainer}>
            <SkeletonShimmer
              width={64}
              height={64}
              borderRadius={9999}
            />
            <View style={styles.avatarNameSpacer}>
              <SkeletonShimmer
                width={48}
                height={12}
                borderRadius={4}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Masonry grid skeleton */}
      <View style={styles.grid}>
        {/* Left column */}
        <View style={styles.column}>
          {CARD_HEIGHTS.filter((_, i) => i % 2 === 0).map((height, i) => (
            <View key={`left-${i}`} style={[styles.card, { height }]}>
              <SkeletonShimmer
                width="100%"
                height={height - 40}
                borderRadius={2}
              />
              <View style={styles.captionSpacer}>
                <SkeletonShimmer
                  width="70%"
                  height={10}
                  borderRadius={4}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Right column */}
        <View style={styles.column}>
          {CARD_HEIGHTS.filter((_, i) => i % 2 !== 0).map((height, i) => (
            <View key={`right-${i}`} style={[styles.card, { height }]}>
              <SkeletonShimmer
                width="100%"
                height={height - 40}
                borderRadius={2}
              />
              <View style={styles.captionSpacer}>
                <SkeletonShimmer
                  width="60%"
                  height={10}
                  borderRadius={4}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  switcherRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarNameSpacer: {
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: COLUMN_GAP,
  },
  column: {
    flex: 1,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 4,
    padding: spacing.sm,
    paddingBottom: 0,
  },
  captionSpacer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FeedSkeleton;
