import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui';

import type { DiaryChapter } from '../services/diaryService';
import { monthLabel, monthShort, monthYear, startsNewYear, plural } from '../utils/diaryFormat';

// ---------------------------------------------------------------------------
// The strand
// ---------------------------------------------------------------------------
//
// The whole year, one tick per month, on a single line — and the line is the
// same thread that runs down the diary, laid on its side.
//
// It does two jobs at once, which is why it earns the space. It is a **map**:
// tick height is that month's photograph count, so a parent sees at a glance
// that October was busy and December was three days long, without reading a
// single number. And it is the **control**: tapping a tick opens that month and
// jumps to it, which is the only way to get from a child's first week to their
// last one in less than a scroll.
//
// It is also the answer to the obvious objection to reading a diary forwards.
// Opening on the beginning is right for a journey and wrong for a parent who
// just wants today — so today is always one tap away, at the right-hand end.

/** Fixed, so the tick for a given month never moves as the strand redraws. */
const COLUMN_WIDTH = 32;

/** The plot area a tick is drawn in, and the shortest a tick may be. */
const PLOT_HEIGHT = 30;
const MIN_TICK = 5;

/**
 * How far the labels reach below the baseline: the gap under the plot, the
 * caption's own line height, and the slot the year sits in.
 *
 * Derived rather than eyeballed, because the baseline is positioned from the
 * bottom of the strand and has to land exactly at the foot of the ticks. A
 * hardcoded number here is the kind that stops matching the moment a label
 * changes size and nobody notices for a month.
 */
const LABEL_BLOCK = spacing.xs + 17 + 13;

export interface DiaryStrandProps {
  /** Oldest month first, as the outline returns them. */
  chapters: DiaryChapter[];
  /** The month currently being read. Drawn filled; scrolled into view. */
  activeMonth: string | null;
  onSelect: (month: string) => void;
}

/**
 * `<DiaryStrand>` — the journey as one line, and the way to move along it.
 *
 * ```tsx
 * <DiaryStrand chapters={diary.chapters} activeMonth={month} onSelect={jumpTo} />
 * ```
 */
export function DiaryStrand({ chapters, activeMonth, onSelect }: DiaryStrandProps) {
  const scrollRef = useRef<ScrollView>(null);

  /**
   * Ticks are scaled against the busiest month rather than against a fixed
   * ceiling, so the shape of the year is legible whether a class shares three
   * photographs a month or three hundred. The floor keeps a one-photograph
   * month visible — a month that happened must not read as a month that did
   * not.
   */
  const peak = useMemo(
    () => Math.max(1, ...chapters.map((c) => c.photoCount)),
    [chapters],
  );

  const activeIndex = chapters.findIndex((c) => c.month === activeMonth);

  // Keep the month being read on screen. Centred rather than merely revealed,
  // so the months either side of it stay visible and the tick keeps its
  // context.
  useEffect(() => {
    if (activeIndex < 0) return;
    scrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * COLUMN_WIDTH - COLUMN_WIDTH * 2),
      animated: true,
    });
  }, [activeIndex]);

  const handlePress = useCallback(
    (month: string) => {
      Haptics.selectionAsync();
      onSelect(month);
    },
    [onSelect],
  );

  if (chapters.length < 2) return null;

  return (
    <View style={styles.host}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
        accessibilityLabel="Jump to a month"
      >
        {/* The baseline every tick stands on — the thread, on its side. It is
            drawn once across the whole run rather than per column, so it has no
            seams between ticks. */}
        <View style={styles.baseline} pointerEvents="none" />

        {chapters.map((chapter, index) => {
          const isActive = chapter.month === activeMonth;
          const height =
            MIN_TICK + (PLOT_HEIGHT - MIN_TICK) * (chapter.photoCount / peak);
          const showYear = startsNewYear(chapter.month, chapters[index - 1]?.month);

          return (
            <Pressable
              key={chapter.month}
              onPress={() => handlePress(chapter.month)}
              style={styles.column}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${monthLabel(chapter.month)}, ${plural(
                chapter.photoCount,
                'photo',
              )}`}
            >
              <View style={styles.plot}>
                <View
                  style={[
                    styles.tick,
                    { height },
                    isActive ? styles.tickActive : styles.tickIdle,
                  ]}
                />
              </View>

              {/* `caption` on paper is 4.64:1 at the lightest; the active month
                  steps up to full ink rather than to marigold, which cannot
                  carry a syllable. */}
              <Text
                variant={isActive ? 'captionBold' : 'caption'}
                color={isActive ? colors.text.primary : colors.text.tertiary}
                numberOfLines={1}
              >
                {monthShort(chapter.month)}
              </Text>

              {/* The year appears once, where it turns over. Printing it under
                  every tick would treble the ink for information that changes
                  twice in a preschool career. */}
              <View style={styles.yearSlot}>
                {showYear && (
                  <Text variant="tiny" color={colors.text.tertiary} numberOfLines={1}>
                    {monthYear(chapter.month)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    // Never shrink. The strand sits between the switcher and a `flex: 1` scroll
    // view, and a ScrollView's own base style is `flexGrow: 1, flexShrink: 1` —
    // left to itself the inner list is squeezed and clips its ticks.
    flexShrink: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  /** Sized by its own content, not stretched to whatever is left over. */
  list: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
  },
  /**
   * Sits at the foot of the plot area, which is `PLOT_HEIGHT` above the labels.
   * Absolute so it spans the full scrollable run rather than stopping at the
   * viewport edge.
   */
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: LABEL_BLOCK,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  column: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    // The tick itself is 8pt wide; the tap target is the whole column, and the
    // plot plus two label lines clears the 44pt minimum on its own.
    minHeight: MIN_TAP_SIZE,
  },
  plot: {
    height: PLOT_HEIGHT,
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  tick: {
    width: 8,
    borderTopLeftRadius: radius.print,
    borderTopRightRadius: radius.print,
  },
  /** Marigold as a surface — the one thing it is allowed to be. */
  tickActive: {
    backgroundColor: colors.primary.amber,
  },
  tickIdle: {
    backgroundColor: colors.border.default,
  },
  /**
   * Reserved whether or not a year is printed, so a tick does not shift up when
   * its neighbour opens a new year.
   */
  yearSlot: {
    height: 13,
    justifyContent: 'center',
  },
});
