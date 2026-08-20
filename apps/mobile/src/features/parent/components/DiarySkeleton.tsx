import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { SkeletonShimmer } from '@/components/feedback';

import { ThreadNode, threadStyles, THREAD_GUTTER } from './DiaryThread';

// ---------------------------------------------------------------------------
// The diary, before it arrives
// ---------------------------------------------------------------------------
//
// The thread is drawn for real — it is a line and two circles, it costs
// nothing, and it is the one part of this screen that is true before any data
// lands. Only the words and the prints are missing.
//
// Every measurement below is read off `DiaryChapterCard` rather than guessed. A
// skeleton whose rows are a different height than what replaces them reflows
// the page the moment the diary lands, which moves the month a parent was
// already reaching for.

/** `spacing.ms` of padding plus half an `h4` line box — the card's own maths. */
const TITLE_CENTRE = spacing.ms + 23 / 2;
const COVER = 60;

/** How many months to stand in for. Four fills a phone without overrunning it. */
const ROWS = [0, 1, 2, 3];

/**
 * `<DiarySkeleton>` — the shape of the journey while it loads.
 */
export function DiarySkeleton() {
  return (
    <View style={styles.container}>
      {/* The opening band: an editorial line and three figures. */}
      <View style={styles.opening}>
        <SkeletonShimmer width={220} height={16} borderRadius={4} index={0} />
        <View style={styles.openingStats}>
          {[0, 1, 2].map((stat) => (
            <SkeletonShimmer
              key={stat}
              width={54}
              height={30}
              borderRadius={radius.xs}
              index={stat + 1}
            />
          ))}
        </View>
      </View>

      {ROWS.map((row) => (
        <View key={row} style={styles.chapter}>
          <ThreadNode
            kind="chapter"
            centre={TITLE_CENTRE}
            capTop={row === 0}
            capBottom={row === ROWS.length - 1}
          />

          <View style={[threadStyles.row, styles.header]}>
            <View style={styles.headerText}>
              <SkeletonShimmer width={132} height={15} borderRadius={4} index={row} />
              <View style={styles.metaLine}>
                <SkeletonShimmer width={98} height={10} borderRadius={4} index={row} />
              </View>
            </View>

            <View style={styles.cover}>
              <SkeletonShimmer
                width="100%"
                height="100%"
                borderRadius={radius.print}
                index={row}
              />
            </View>
          </View>
        </View>
      ))}
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
  opening: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  openingStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  chapter: {
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    paddingRight: spacing.md,
    minHeight: THREAD_GUTTER,
  },
  headerText: {
    flex: 1,
  },
  /** `lineHeight.caption` is 17; the real card leaves 2pt above it. */
  metaLine: {
    height: 17,
    marginTop: spacing.xxs,
    justifyContent: 'center',
  },
  cover: {
    width: COVER,
    height: COVER,
    padding: spacing.xs,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
    ...platformShadow(shadows.small),
  },
});

export default DiarySkeleton;
