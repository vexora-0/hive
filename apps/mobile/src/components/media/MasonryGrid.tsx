import React from 'react';
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
}: MasonryGridProps<T>) {
  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      numColumns={2}
      masonry
      // Lets FlashList place the next item in whichever column is shorter,
      // which is what keeps the two columns from drifting apart.
      optimizeItemArrangement
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  contentWithTabBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: layout.tabBarClearance,
  },
  rowGap: {
    height: spacing.ms,
  },
});

export default MasonryGrid;
