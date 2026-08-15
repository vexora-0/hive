import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { SkeletonShimmer } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
//
// Every number below is read off `(parent)/feed.tsx` rather than guessed. A
// skeleton whose proportions do not match what replaces it is worse than no
// skeleton at all: the wall reflows the moment the photographs land, and the
// row a parent was already reaching for moves out from under their thumb.

const SCREEN_WIDTH = Dimensions.get('window').width;

/** The list's own inset — `EDGE` in the feed. */
const LIST_EDGE = spacing.sm;
/** Each row's inset inside that. */
const ROW_EDGE = spacing.xs;
/** The gutter between two mounts in a pair row. */
const PAIR_GAP = spacing.sm;
/** The mat `<PhotoMount>` draws around the print. */
const MAT = spacing.sm;
/** The mount's deeper bottom margin, where a caption would be printed. */
const MAT_BOTTOM = spacing.md;

const HERO_WIDTH = SCREEN_WIDTH - LIST_EDGE * 2 - ROW_EDGE * 2;
const PAIR_WIDTH = (HERO_WIDTH - PAIR_GAP) / 2;

/**
 * The three print ratios `<PhotoMount>` falls back to, in the proportion the
 * wall actually shows them: a day opens on a portrait and settles into squarer
 * pairs.
 */
const HERO_RATIO = 0.8;
const PAIR_RATIOS = [1, 0.8] as const;

const heroHeight = (HERO_WIDTH - MAT * 2) / HERO_RATIO;
const pairHeight = (ratio: number) => (PAIR_WIDTH - MAT * 2) / ratio;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One paper mount with the photograph still missing. */
function MountPlate({
  width,
  height,
  index,
}: {
  width: number;
  height: number;
  index: number;
}) {
  return (
    <View style={[styles.mount, { width }]}>
      <SkeletonShimmer
        width="100%"
        height={height}
        borderRadius={radius.print}
        index={index}
      />
      <View style={styles.captionBand} />
    </View>
  );
}

/**
 * The sticky day header: a date, and the count under it.
 *
 * The two bars sit in boxes the height of the **line heights** they stand in
 * for — `h4` at 23 and `caption` at 17 — rather than being drawn at whatever
 * height looked right. That is what keeps the header block the same height
 * before and after the words arrive, which is the whole job of a skeleton.
 */
function DayHeaderPlate({ index }: { index: number }) {
  return (
    <View style={styles.dayHeader}>
      <View style={styles.titleLine}>
        <SkeletonShimmer width={128} height={15} borderRadius={4} index={index} />
      </View>
      <View style={styles.metaLine}>
        <SkeletonShimmer width={96} height={10} borderRadius={4} index={index} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<FeedSkeleton>` — the wall before the photographs arrive.
 *
 * Real mounts with empty windows rather than grey rectangles: the paper, the
 * corner radius, the deeper bottom mat and the day header are all already
 * correct, so the only thing missing is the picture. That is the difference
 * between "loading" and "nothing here".
 *
 * `SkeletonShimmer` waits out its own 200ms before showing, so a feed already
 * in cache goes straight up with nothing flashing grey behind it.
 */
export function FeedSkeleton() {
  return (
    <View style={styles.container}>
      <DayHeaderPlate index={0} />

      <View style={styles.heroRow}>
        <MountPlate width={HERO_WIDTH} height={heroHeight} index={0} />
      </View>

      <View style={styles.pairRow}>
        {PAIR_RATIOS.map((ratio, i) => (
          <MountPlate
            key={`first-${i}`}
            width={PAIR_WIDTH}
            height={pairHeight(ratio)}
            index={i + 1}
          />
        ))}
      </View>

      <DayHeaderPlate index={3} />

      <View style={styles.pairRow}>
        {PAIR_RATIOS.map((ratio, i) => (
          <MountPlate
            key={`second-${i}`}
            width={PAIR_WIDTH}
            height={pairHeight(ratio)}
            index={i + 4}
          />
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
    paddingHorizontal: LIST_EDGE,
  },
  dayHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.ms,
  },
  /** `lineHeight.h4` — the box the day's name will occupy. */
  titleLine: {
    height: 23,
    justifyContent: 'center',
  },
  /** `lineHeight.caption`, and the same 2pt gap the real header uses. */
  metaLine: {
    height: 17,
    marginTop: spacing.xxs,
    justifyContent: 'center',
  },
  heroRow: {
    paddingHorizontal: ROW_EDGE,
    marginBottom: spacing.ms,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: ROW_EDGE,
    gap: PAIR_GAP,
    marginBottom: spacing.ms,
  },
  mount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: MAT,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  captionBand: {
    height: MAT_BOTTOM,
  },
});

export default FeedSkeleton;
