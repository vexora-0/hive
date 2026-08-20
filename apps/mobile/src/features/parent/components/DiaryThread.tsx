import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------
//
// One vertical line runs the length of the diary, and every row hangs a node on
// it. That line is the whole idea of the screen: it is what turns a list of
// months into a journey with a beginning, and it is what a parent's eye follows
// from the first day to today.
//
// It is drawn **per row** rather than once behind the list. A single absolutely
// positioned line would have to know the total height of a list whose rows
// expand and collapse as chapters open, and would either fall short of the last
// node or overshoot past it. Each row drawing its own segment means the line is
// exactly as long as the diary is, at every moment, with no measurement.
//
// The rows that cap the ends — the first and last — trim their own half of the
// segment so the thread starts and stops *at* its terminals rather than
// running past them into nothing.

/** The gutter the thread lives in. Every diary row reserves exactly this. */
export const THREAD_GUTTER = 30;

/** Where the line sits inside that gutter, and how thick it is. */
const LINE_X = 14;
const LINE_WIDTH = 2;

const CHAPTER_DOT = 14;
const ENTRY_DOT = 8;
const TERMINUS_RING = 16;

export type ThreadNodeKind = 'chapter' | 'entry' | 'terminus';

export interface ThreadNodeProps {
  kind: ThreadNodeKind;
  /**
   * Filled rather than hollow. A chapter fills when it is open, so the node
   * itself says which month is being read — the thread doubles as the state
   * indicator and no chevron has to carry it alone.
   */
  active?: boolean;
  /** Trims the segment above the node. Set on the first row of the diary. */
  capTop?: boolean;
  /** Trims the segment below the node. Set on the last row. */
  capBottom?: boolean;
  /**
   * The node's **centre**, measured down from the top of the row.
   *
   * A node has to line up with the *first line of type* beside it, not with the
   * centre of a row whose height depends on how many photographs that day held.
   * Callers pass the y of their own heading's midline and the node centres on
   * it, whatever size the node happens to be.
   */
  centre?: number;
}

/**
 * `<ThreadNode>` — one row's segment of the thread, with its node on it.
 *
 * ```tsx
 * <ThreadNode kind="chapter" active={isOpen} centre={24} />
 * ```
 */
export function ThreadNode({
  kind,
  active = false,
  capTop = false,
  capBottom = false,
  centre = 0,
}: ThreadNodeProps) {
  const size =
    kind === 'chapter' ? CHAPTER_DOT : kind === 'entry' ? ENTRY_DOT : TERMINUS_RING;

  return (
    <View style={styles.gutter} pointerEvents="none">
      {/* Above the node. */}
      {!capTop && <View style={[styles.line, { top: 0, height: centre }]} />}
      {/* Below it, to the foot of the row — however tall the row turns out. */}
      {!capBottom && <View style={[styles.line, { top: centre, bottom: 0 }]} />}

      <View
        style={[
          styles.node,
          {
            top: centre - size / 2,
            left: LINE_X + LINE_WIDTH / 2 - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          kind === 'chapter' && (active ? styles.chapterOpen : styles.chapterShut),
          kind === 'entry' && styles.entryDot,
          kind === 'terminus' && styles.terminus,
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  gutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: THREAD_GUTTER,
  },
  line: {
    position: 'absolute',
    left: LINE_X,
    width: LINE_WIDTH,
    backgroundColor: colors.border.default,
  },
  node: {
    position: 'absolute',
    // The halo. Without it the line runs visibly under a hollow node and the
    // node reads as a bead threaded on a wire rather than as a point on it.
    borderColor: colors.background.cream,
    borderWidth: 0,
  },

  /**
   * An open month. Marigold, and filled — it is a **surface** here, which is
   * the only thing marigold is allowed to be. Nothing is written on it.
   */
  chapterOpen: {
    backgroundColor: colors.primary.amber,
    borderWidth: 3,
    borderColor: colors.background.cream,
  },
  /** A closed month: paper with a marigold rim, so it still reads as a node. */
  chapterShut: {
    backgroundColor: colors.background.surface,
    borderWidth: 3,
    borderColor: colors.primary.amber,
  },
  /** A day. Smaller and quieter — the months are the structure, days the detail. */
  entryDot: {
    backgroundColor: colors.border.dark,
    borderWidth: 2,
    borderColor: colors.background.cream,
  },
  /** The two ends of the journey: an open ring, drawn in ink. */
  terminus: {
    backgroundColor: colors.background.cream,
    borderWidth: 2,
    borderColor: colors.ink[500],
  },
});

/** Shared inset for anything sitting beside the thread. */
export const threadStyles = StyleSheet.create({
  row: {
    paddingLeft: THREAD_GUTTER + spacing.xs,
  },
});
