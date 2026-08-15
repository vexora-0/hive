import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';

import { colors, spacing, layout } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MasonryGridProps<T> {
  /** Data source. Each item needs a unique `id`. */
  data: T[];
  /** Render function for each item. */
  renderItem: ListRenderItem<T>;
  /** Called when the user scrolls near the end. */
  onEndReached?: () => void;
  /** Whether a pull-to-refresh is in flight. */
  refreshing?: boolean;
  /** Pull-to-refresh handler. */
  onRefresh?: () => void;
  /** Rendered above the list. */
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Rendered when the data array is empty. */
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
  /** Rendered below the list — loading spinners, end-of-list marks. */
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  /** Scroll handler, for driving a collapsing header. */
  onScroll?: React.ComponentProps<typeof FlashList>['onScroll'];
  /** Leaves room at the bottom for the floating tab bar. @default true */
  tabBarClearance?: boolean;
  /**
   * How many columns the wall runs at. **Two by default, and it should stay
   * two**: at 3-up on a 390pt screen a cell is barely 110pt wide, which is not
   * enough to recognise a face — and recognising a face is the entire reason a
   * parent opened the app. Three is for a dense archive being scanned, never
   * for the feed.
   * @default 2
   */
  columns?: 2 | 3;
  /**
   * Stable identity per row. Defaults to the item's `id`, which is what every
   * caller passes today.
   *
   * Worth stating why this exists: without it FlashList keys rows by index, so
   * a refetch that prepends a photo re-keys every row below it and each
   * recycled cell repaints. The photo's own id keeps a row attached to its
   * photograph.
   */
  keyExtractor?: (item: T, index: number) => string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<MasonryGrid>` — the two-column wall of photo mounts.
 *
 * True masonry rather than a grid: mounts keep their own print ratio and the
 * columns stay independent, so a wall of photos has the uneven rhythm of
 * prints pinned to a board instead of the lockstep of a spreadsheet.
 *
 * The wall runs close to the screen edges on purpose. A photograph is the only
 * thing on this screen worth looking at, so the page gives it the width and
 * keeps the gutter to the width of the mat around each print.
 *
 * ```tsx
 * <MasonryGrid data={photos} renderItem={renderMount} onEndReached={loadMore} />
 * ```
 */
export function MasonryGrid<T>({
  data,
  renderItem,
  onEndReached,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  onScroll,
  tabBarClearance = true,
  columns = 2,
  keyExtractor,
}: MasonryGridProps<T>) {
  // Falls back to the item's own `id` — see the prop comment. The cast is the
  // one place this component has to assume the shape its documentation asks
  // for; everything else about `T` stays the caller's business.
  const resolveKey = useCallback(
    (item: T, index: number): string => {
      if (keyExtractor) return keyExtractor(item, index);
      const id = (item as { id?: unknown })?.id;
      return typeof id === 'string' || typeof id === 'number'
        ? String(id)
        : String(index);
    },
    [keyExtractor],
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={resolveKey}
      numColumns={columns}
      masonry
      /**
       * **Leave this off.**
       *
       * `optimizeItemArrangement` lets FlashList put the next item in whichever
       * column is currently shorter, which levels the two columns beautifully —
       * by reordering the photographs. In a feed sorted newest-first that
       * silently breaks chronology: Tuesday afternoon appears above Wednesday
       * morning whenever it happens to fit better, and nothing throws, nothing
       * logs, and no test catches it. A parent scrolling a keepsake album reads
       * the order as the story.
       *
       * A ragged column bottom is the correct price for a feed that is still in
       * the order it happened. The prop looks helpful; it is not.
       */
      optimizeItemArrangement={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            // The readable marigold, not the marigold itself: `primary.amber`
            // is 2.03:1 and a spinner drawn in it disappears against paper.
            tintColor={colors.primary.amberDark}
            colors={[colors.primary.amberDark]}
            progressBackgroundColor={colors.background.surface}
          />
        ) : undefined
      }
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={
        tabBarClearance ? styles.contentWithTabBar : styles.content
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

function Separator() {
  return <View style={styles.rowGap} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * The wall's outer margin. Deliberately half the usual screen padding: the
 * mounts carry their own white mat, so a 16pt gutter *plus* an 8pt mat reads as
 * a photo lost inside two frames. 8pt here gives each cell about 20pt more
 * width, which is the difference between a face you recognise and a face you
 * squint at.
 */
const EDGE = spacing.sm;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: EDGE,
    paddingBottom: spacing.xl,
  },
  contentWithTabBar: {
    paddingHorizontal: EDGE,
    paddingBottom: layout.tabBarClearance,
  },
  rowGap: {
    height: spacing.ms,
  },
});

export default MasonryGrid;
