import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui';
import { HiveImage } from '@/components/media';
import { UploadProgress } from './UploadProgress';
import type { UploadImage } from '@/features/teacher/hooks/useUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadPreviewProps {
  /** Every image the pipeline is tracking, in the order they were picked. */
  images: UploadImage[];
  /** Remove an image from the selection. Offered only while it is idle. */
  onRemove: (id: string) => void;
  /** Retry one failed image. */
  onRetry?: (id: string) => void;
  /** Container style — the screen decides how much height this gets. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UploadPreview>` — the photographs being shared, in whichever of its two
 * shapes the moment calls for.
 *
 * **While the teacher is composing** it is a pager: one photograph at a time,
 * as large as the screen will allow, swiped through with a thumb while the
 * other hand taps names on the rail docked below it. That is the whole point of
 * the layout — reviewing a photo and saying who is in it happen on one screen,
 * with no sheet opening and closing between them.
 *
 * **Once sending starts it becomes a list of rows**, one per file, each with its
 * own progress and its own retry. This is not decoration: in a pager, photo
 * fourteen failing is invisible until you swipe to it, and a teacher watching
 * twenty photos go out over preschool wifi needs to see the two that did not at
 * the moment they did not. The pager is for choosing; rows are for watching.
 *
 * Photographs are fitted, never filled. A selection view that crops to square
 * hides the top of the frame the teacher deliberately included, and they cannot
 * see what they are actually sending.
 */
export function UploadPreview({
  images,
  onRemove,
  onRetry,
  style,
}: UploadPreviewProps) {
  // Derived rather than passed: "has anything left the idle state" is exactly
  // the question, and the images already answer it. A `mode` prop would let a
  // caller show a pager over files that are mid-flight.
  const sending = images.some((image) => image.state !== 'idle');

  if (images.length === 0) return null;

  return sending ? (
    <UploadRows
      images={images}
      onRemove={onRemove}
      onRetry={onRetry}
      style={style}
    />
  ) : (
    <UploadPager images={images} onRemove={onRemove} style={style} />
  );
}

// ---------------------------------------------------------------------------
// The pager — composing
// ---------------------------------------------------------------------------

interface UploadPagerProps {
  images: UploadImage[];
  onRemove: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

function UploadPager({ images, onRemove, style }: UploadPagerProps) {
  // Measured rather than taken from the window, because the screen decides how
  // much width to give this — a page sized to the window inside a padded parent
  // drifts a little further out of register with every swipe.
  const [pageWidth, setPageWidth] = useState(0);
  const [current, setCurrent] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setPageWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  // Read at the end of the throw rather than on every frame: the counter under
  // the pager is a label, not a scrubber, and updating it mid-gesture makes it
  // flicker between two numbers while the finger is still down.
  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setCurrent(Math.max(0, Math.min(images.length - 1, index)));
    },
    [pageWidth, images.length],
  );

  const renderPage = useCallback(
    ({ item, index }: { item: UploadImage; index: number }) => (
      <View style={[styles.page, { width: pageWidth }]}>
        <View style={styles.frame}>
          <HiveImage
            uri={item.uri}
            contentFit="contain"
            recyclingKey={item.id}
            style={styles.photo}
          />

          <Pressable
            onPress={() => onRemove(item.id)}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${index + 1} of ${images.length}`}
            style={styles.removeButton}
          >
            <Ionicons name="close" size={20} color={colors.text.onInk} />
          </Pressable>
        </View>
      </View>
    ),
    [pageWidth, images.length, onRemove],
  );

  return (
    <View style={[styles.pagerHost, style]} onLayout={handleLayout}>
      {pageWidth > 0 && (
        <FlatList
          data={images}
          keyExtractor={(item) => item.id}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
        />
      )}

      <Text variant="caption" muted center style={styles.counter}>
        {`Photo ${Math.min(current + 1, images.length)} of ${images.length}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The rows — sending
// ---------------------------------------------------------------------------

interface UploadRowsProps {
  images: UploadImage[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A failed row keeps **two** ways out, and the second one is not optional.
 *
 * A photograph that fails every retry — a file the server will never accept —
 * otherwise traps the whole batch: the rail is frozen from the moment Share is
 * pressed, the batch is only cleared once every file has landed, and Retry is
 * the only control on offer. Dropping the one bad file lets the rest of the
 * batch finish and the teacher carry on.
 */
function UploadRows({ images, onRemove, onRetry, style }: UploadRowsProps) {
  return (
    <ScrollView
      style={[styles.rowsHost, style]}
      contentContainerStyle={styles.rowsContent}
      showsVerticalScrollIndicator={false}
    >
      {images.map((image, index) => (
        <View key={image.id} style={styles.row}>
          <View style={styles.rowThumb}>
            <HiveImage
              uri={image.uri}
              contentFit="cover"
              recyclingKey={image.id}
              style={styles.rowThumbImage}
            />
          </View>

          <View style={styles.rowBody}>
            <Text variant="bodySmallBold" numberOfLines={1}>
              {`Photo ${index + 1}`}
            </Text>
            <UploadProgress
              state={image.state}
              progress={image.progress}
              error={image.error}
              onRetry={
                image.state === 'error' && onRetry
                  ? () => onRetry(image.id)
                  : undefined
              }
            />
          </View>

          {image.state === 'error' && (
            <Pressable
              onPress={() => onRemove(image.id)}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={`Drop photo ${index + 1} from this batch`}
              style={styles.rowDrop}
            >
              <Ionicons name="close" size={17} color={colors.text.secondary} />
              <Text variant="caption" color={colors.text.secondary}>
                Drop
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** The thumbnail beside a sending row — big enough to tell two photos apart. */
const ROW_THUMB = 60;
/** The circular remove control's visual size; `hitSlop` takes touch to 44. */
const REMOVE_SIZE = MIN_TAP_SIZE - spacing.sm * 2;

const styles = StyleSheet.create({
  // ── Pager ──────────────────────────────────────────────────────────
  pagerHost: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
  },
  // `radius.print`, not `radius.mount`: this is a light table holding a
  // photograph, not a print in a mat, and the two photo radii on one screen
  // would be two values doing one job.
  frame: {
    flex: 1,
    borderRadius: radius.print,
    backgroundColor: colors.background.surfaceSecondary,
    overflow: 'hidden',
  },
  photo: {
    flex: 1,
    width: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Its own ground, because a pale photograph is behind it as often as a dark
    // one and a glyph that only reads on half of them is not a control.
    backgroundColor: colors.overlay.dark,
  },
  counter: {
    paddingTop: spacing.sm,
  },

  // ── Rows ───────────────────────────────────────────────────────────
  rowsHost: {
    flex: 1,
  },
  rowsContent: {
    gap: spacing.ms,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  rowThumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    borderRadius: radius.print,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
  },
  rowThumbImage: {
    width: '100%',
    height: '100%',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowDrop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minWidth: MIN_TAP_SIZE - spacing.sm * 2,
    minHeight: MIN_TAP_SIZE - spacing.sm * 2,
  },
});

export default UploadPreview;
