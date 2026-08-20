import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { Text } from '@/components/ui';
import { HiveImage } from '@/components/media';
import { Reveal } from '@/components/animation';
import { SkeletonShimmer } from '@/components/feedback';

import type { FeedPhoto } from '../services/parentService';
import type { DiaryChapter } from '../services/diaryService';
import { useDiaryChapter } from '../hooks/useDiary';
import { ThreadNode, threadStyles } from './DiaryThread';
import { DiaryEntryRow } from './DiaryEntry';
import { monthLabel, plural } from '../utils/diaryFormat';

// ---------------------------------------------------------------------------
// A chapter
// ---------------------------------------------------------------------------
//
// A month of the diary, shut by default and opened by tapping it.
//
// Shut, it is one line and one small print — so a two-year journey is a
// screenful of months rather than a scroll nobody reaches the end of, and the
// child's whole time at the school is visible at once. Open, it fetches its own
// days; a chapter nobody opens costs nothing, and React Query keeps an opened
// one, so shutting and reopening a month never goes back to the network.

/**
 * The midline of the chapter's title, from the top of the row.
 *
 * `h4` sits in a 23pt line box under `spacing.ms` of padding. The cover print
 * beside it is taller than the title, so centring the node on the *row* would
 * hang it level with the middle of a photograph rather than with the month it
 * names.
 */
const TITLE_CENTRE = spacing.ms + 23 / 2;

/** The cover print. Small — it identifies the month, it is not the content. */
const COVER = 60;

export interface DiaryChapterCardProps {
  chapter: DiaryChapter;
  studentId: string;
  /** The journey's first photograph, for day numbering inside the chapter. */
  journeyStart: string | null;
  isOpen: boolean;
  onToggle: (month: string) => void;
  onPhotoPress: (photo: FeedPhoto) => void;
  onPhotoLongPress: (photo: FeedPhoto) => void;
}

/**
 * `<DiaryChapterCard>` — one month on the thread.
 *
 * ```tsx
 * <DiaryChapterCard chapter={c} isOpen={open.has(c.month)} onToggle={toggle} … />
 * ```
 */
export function DiaryChapterCard({
  chapter,
  studentId,
  journeyStart,
  isOpen,
  onToggle,
  onPhotoPress,
  onPhotoLongPress,
}: DiaryChapterCardProps) {
  const { chapter: page, isLoading, isError, refetch } = useDiaryChapter(
    studentId,
    chapter.month,
    isOpen,
  );

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync();
    onToggle(chapter.month);
  }, [onToggle, chapter.month]);

  const meta = `${plural(chapter.photoCount, 'photo')} · ${plural(
    chapter.dayCount,
    'day',
  )}`;

  return (
    <View style={styles.chapter}>
      <ThreadNode kind="chapter" active={isOpen} centre={TITLE_CENTRE} />

      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [
          threadStyles.row,
          styles.header,
          pressed && styles.headerPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${monthLabel(chapter.month)}, ${meta}`}
        accessibilityHint={isOpen ? 'Closes this month' : 'Opens this month'}
      >
        <View style={styles.headerText}>
          <Text variant="h4" accessibilityRole="header">
            {monthLabel(chapter.month)}
          </Text>
          <Text variant="caption" color={colors.text.tertiary} style={styles.meta}>
            {meta}
          </Text>
        </View>

        {/* The month's opening print, in a paper frame the size of a stamp.
            Square and sharp-cornered like every other print in the app — the
            radius family that holds photographs never grows to match the
            controls around it. */}
        {chapter.cover && (
          <View style={styles.cover}>
            <HiveImage
              uri={chapter.cover.thumbnailUri ?? chapter.cover.uri}
              blurhash={chapter.cover.blurhash ?? undefined}
              recyclingKey={chapter.cover.id}
              style={styles.coverImage}
            />
          </View>
        )}

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={17}
          color={colors.text.tertiary}
        />
      </Pressable>

      {isOpen && (
        <View style={styles.body}>
          {isLoading && <ChapterLoading />}

          {isError && (
            <View style={threadStyles.row}>
              <Text variant="bodySmall" muted>
                This month didn&apos;t load.
              </Text>
              <Pressable
                onPress={() => refetch()}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.retry}
              >
                <Text variant="bodySmallBold" color={colors.text.link}>
                  Try again
                </Text>
              </Pressable>
            </View>
          )}

          {page && (
            <Reveal from="up" distance={8}>
              {page.entries.map((entry) => (
                <DiaryEntryRow
                  key={entry.date}
                  entry={entry}
                  journeyStart={journeyStart}
                  onPhotoPress={onPhotoPress}
                  onPhotoLongPress={onPhotoLongPress}
                />
              ))}

              {/* A busy month can hold more than one response returns. Saying so
                  is the difference between a month that ended and a month we
                  stopped reading. */}
              {page.truncated && (
                <View style={[threadStyles.row, styles.truncated]}>
                  <Text variant="caption" color={colors.text.tertiary}>
                    Showing the first part of this month.
                  </Text>
                </View>
              )}
            </Reveal>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Two days' worth of empty diary while the month arrives.
 *
 * Shaped like `<DiaryEntryRow>` rather than drawn as generic bars — the heading,
 * the meta line and the strip of prints are all already in the right places, so
 * nothing under the parent's thumb moves when the photographs land.
 */
function ChapterLoading() {
  return (
    <View style={threadStyles.row}>
      {[0, 1].map((row) => (
        <View key={row} style={styles.skeletonDay}>
          <SkeletonShimmer width={104} height={13} borderRadius={4} index={row * 2} />
          <View style={styles.skeletonMeta}>
            <SkeletonShimmer width={148} height={10} borderRadius={4} index={row * 2 + 1} />
          </View>
          <View style={styles.skeletonStrip}>
            {[0, 1, 2].map((cell) => (
              <View key={cell} style={styles.skeletonPrint}>
                <SkeletonShimmer
                  width="100%"
                  height={100}
                  borderRadius={radius.print}
                  index={row * 2 + cell}
                />
              </View>
            ))}
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
  chapter: {
    // The thread is drawn absolutely inside this, so the row must not clip it.
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    paddingRight: spacing.md,
  },
  /**
   * Opacity rather than a tint.
   *
   * The thread is drawn as an absolutely positioned sibling *behind* this row,
   * so a background colour on a Pressable that spans the full width paints over
   * the gutter and the month's node vanishes for as long as a finger is down.
   * Fading the row's own content leaves the thread alone.
   */
  headerPressed: {
    opacity: 0.6,
  },
  headerText: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.xxs,
  },
  cover: {
    width: COVER,
    height: COVER,
    padding: spacing.xs,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
    ...platformShadow(shadows.small),
  },
  coverImage: {
    flex: 1,
    borderRadius: radius.print,
  },
  body: {
    paddingBottom: spacing.ms,
  },
  retry: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  truncated: {
    paddingTop: spacing.ms,
  },

  skeletonDay: {
    paddingTop: spacing.ms,
  },
  skeletonMeta: {
    marginTop: spacing.sm,
  },
  skeletonStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  skeletonPrint: {
    width: 116,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
  },
});
