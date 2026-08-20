import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui';
import { PhotoMount } from '@/components/media';
import { formatTime } from '@/utils/formatDate';

import type { FeedPhoto } from '../services/parentService';
import type { DiaryEntry } from '../services/diaryService';
import { ThreadNode, threadStyles } from './DiaryThread';
import { dayLabel, dayNumber, plural, teacherLabel } from '../utils/diaryFormat';

// ---------------------------------------------------------------------------
// A day
// ---------------------------------------------------------------------------
//
// One day of school, written as one line of a diary: when it was, how far into
// the journey it sits, who was there, and the prints from it laid out in a row.
//
// The prints run **horizontally**. Stacking them would make a busy Tuesday
// taller than a quiet fortnight and destroy the one thing a timeline is for —
// that distance down the page means elapsed time. Sideways, every day is the
// same height whether it held two photographs or twenty, so the diary stays a
// diary rather than turning back into a feed with dates on it.

/** How wide one print in the day's row is. */
const PRINT_WIDTH = 116;

/**
 * The midline of the day's heading, measured from the top of the row.
 *
 * `bodySmallBold` has a 21pt line box and the row opens with `spacing.ms` of
 * padding, so the thread's dot centres here rather than on a row whose height
 * nobody can predict.
 */
const HEADING_CENTRE = spacing.ms + 21 / 2;

/** Two instants are "the same moment" if they are inside this. */
const SAME_MOMENT_MS = 60_000;

export interface DiaryEntryRowProps {
  entry: DiaryEntry;
  /** The journey's first photograph, for the day count. */
  journeyStart: string | null;
  onPhotoPress: (photo: FeedPhoto) => void;
  onPhotoLongPress: (photo: FeedPhoto) => void;
}

/**
 * When the day happened, as a parent would say it.
 *
 * A single photograph gets an instant; a day that ran from mid-morning to home
 * time gets the span, because "9:42 – 11:58" is the fact that makes a row of
 * pictures into a morning.
 */
function timeSpan(firstAt: string, lastAt: string): string {
  const start = formatTime(firstAt);
  const spread = Date.parse(lastAt) - Date.parse(firstAt);
  if (!Number.isFinite(spread) || spread < SAME_MOMENT_MS) return start;
  return `${start} – ${formatTime(lastAt)}`;
}

/**
 * `<DiaryEntryRow>` — one day on the thread.
 *
 * ```tsx
 * <DiaryEntryRow entry={day} journeyStart={diary.summary.firstPhotoAt} … />
 * ```
 */
export function DiaryEntryRow({
  entry,
  journeyStart,
  onPhotoPress,
  onPhotoLongPress,
}: DiaryEntryRowProps) {
  const day = dayNumber(entry.date, journeyStart);
  const teacher = teacherLabel(entry.teachers);

  /**
   * The day's note.
   *
   * The first caption a teacher wrote that day, not all of them: the entry is a
   * line in a diary, and four notes stacked under one date is a comment thread.
   * The rest travel with their own prints in the viewer.
   */
  const note = useMemo(
    () => entry.photos.find((photo) => photo.caption?.trim())?.caption?.trim(),
    [entry.photos],
  );

  const meta = [timeSpan(entry.firstAt, entry.lastAt), teacher]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <ThreadNode kind="entry" centre={HEADING_CENTRE} />

      <View style={threadStyles.row}>
        <View style={styles.heading}>
          <Text variant="bodySmallBold" accessibilityRole="header">
            {dayLabel(entry.date)}
          </Text>

          {/* How far into the journey this day sits — the diary's spine, and
              the reason a parent can tell a first week from a fourth term at a
              glance. Marigold wash as a *surface*; the words are the readable
              marigold, which measures 5.12:1 on it. */}
          {day !== null && day > 0 && (
            <View style={styles.dayPill}>
              <Text variant="tiny" color={colors.text.accent}>
                Day {day}
              </Text>
            </View>
          )}
        </View>

        <Text variant="caption" color={colors.text.tertiary} style={styles.meta}>
          {meta}
        </Text>

        {note && (
          <Text variant="bodySmall" muted numberOfLines={3} style={styles.note}>
            {note}
          </Text>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          // The row is the day's photographs; announcing the count here saves a
          // screen-reader user swiping through to find out how long it is.
          accessibilityLabel={plural(entry.photoCount, 'photo')}
        >
          {entry.photos.map((photo) => (
            <View key={photo.id} style={styles.print}>
              <PhotoMount
                id={photo.id}
                uri={photo.thumbnailUri ?? photo.uri}
                blurhash={photo.blurhash ?? undefined}
                // Square, deliberately. A row of prints at their true ratios
                // has a ragged foot, and the eye reads the ragged edge as the
                // subject rather than reading the pictures.
                aspectRatio={1}
                onPress={() => onPhotoPress(photo)}
                onLongPress={() => onPhotoLongPress(photo)}
                accessibilityLabel={`Photo from ${dayLabel(entry.date)}${
                  photo.caption ? `. ${photo.caption}` : ''
                }`}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    paddingTop: spacing.ms,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.amberWash,
  },
  meta: {
    marginTop: spacing.xxs,
  },
  note: {
    marginTop: spacing.xs,
  },
  strip: {
    paddingTop: spacing.sm,
    // Room on the right for the last print's shadow, which is otherwise clipped
    // flat against the end of the scroll content.
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  print: {
    width: PRINT_WIDTH,
  },
});
