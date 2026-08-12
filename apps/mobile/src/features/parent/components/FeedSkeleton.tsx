import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { SkeletonShimmer } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = spacing.ms;
const HORIZONTAL_PADDING = spacing.md * 2;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING - COLUMN_GAP) / 2;
const MAT = spacing.sm;
const CAPTION_BAND = 34;

/**
 * The same three print ratios `<PhotoMount>` seeds from, in the same
 * proportion, so the skeleton has the real wall's rhythm and the layout does
 * not jump when the photos land.
 */
const IMAGE_HEIGHTS = [1, 0.8, 0.75, 1, 0.75, 0.8].map(
  (ratio) => (CARD_WIDTH - MAT * 2) / ratio,
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<FeedSkeleton>` — the wall before the photos arrive.
 *
 * Real mounts with shimmering windows, not grey rectangles: the paper, the
 * corner radius and the caption band are all already correct, so only the
 * photograph is missing.
 */
export function FeedSkeleton() {
  const columns = [
    IMAGE_HEIGHTS.filter((_, i) => i % 2 === 0),
    IMAGE_HEIGHTS.filter((_, i) => i % 2 !== 0),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {columns.map((heights, columnIndex) => (
          <View key={`column-${columnIndex}`} style={styles.column}>
            {heights.map((height, i) => (
              <View key={`${columnIndex}-${i}`} style={styles.mount}>
                <SkeletonShimmer
                  width="100%"
                  height={height}
                  borderRadius={radius.print}
                  index={i * 2 + columnIndex}
                />
                <View style={styles.captionBand}>
                  <SkeletonShimmer
                    width={columnIndex === 0 ? '62%' : '48%'}
                    height={9}
                    borderRadius={4}
                    index={i * 2 + columnIndex}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
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
  grid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: COLUMN_GAP,
  },
  column: {
    flex: 1,
    gap: COLUMN_GAP,
  },
  mount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: MAT,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  captionBand: {
    height: CAPTION_BAND,
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
});

export default FeedSkeleton;
