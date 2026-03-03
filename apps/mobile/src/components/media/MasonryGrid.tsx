import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';

import { spacing } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MasonryGridProps<T> {
  /** Data source array. Each item should have a unique `id` field. */
  data: T[];
  /** Render function for each item. */
  renderItem: ListRenderItem<T>;
  /** Estimated item height used by FlashList for layout calculations. @default 250 */
  estimatedItemSize?: number;
  /** Called when the user scrolls near the end of the list. */
  onEndReached?: () => void;
  /** Whether the list is currently refreshing. */
  refreshing?: boolean;
  /** Pull-to-refresh handler. */
  onRefresh?: () => void;
  /** Component rendered above the list. */
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Component rendered when the data array is empty. */
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<MasonryGrid>` — a performant two-column masonry layout backed by
 * `@shopify/flash-list`.
 *
 * Items are rendered in two columns. FlashList handles recycling and
 * virtualisation for you, so this grid stays smooth even with hundreds
 * of photos.
 *
 * ```tsx
 * <MasonryGrid
 *   data={photos}
 *   renderItem={({ item }) => <PolaroidCard {...item} />}
 *   onEndReached={loadMore}
 * />
 * ```
 */
export function MasonryGrid<T>({
  data,
  renderItem,
  estimatedItemSize = 250,
  onEndReached,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
}: MasonryGridProps<T>) {
  const columnWrapper = useCallback(
    () => <View style={styles.columnGap} />,
    [],
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      numColumns={2}
      estimatedItemSize={estimatedItemSize}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ItemSeparatorComponent={() => <View style={styles.rowGap} />}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowGap: {
    height: spacing.sm,
  },
  columnGap: {
    width: spacing.sm,
  },
});

export default MasonryGrid;
