import React, { useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

import { colors, spacing } from '@/theme';
import { Avatar } from '@/components/ui';
import { Text } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChildItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ChildSwitcherProps {
  /** Array of children to display. */
  children: ChildItem[];
  /** Currently selected child id. */
  selectedId?: string | null;
  /** Called when a child avatar is tapped. */
  onSelect: (child: ChildItem) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 64;
const RING_WIDTH = 3;
const ITEM_WIDTH = AVATAR_SIZE + RING_WIDTH * 2 + spacing.md;

// ---------------------------------------------------------------------------
// Animated avatar item
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChildAvatarItemProps {
  item: ChildItem;
  isSelected: boolean;
  onPress: () => void;
}

function ChildAvatarItem({ item, isSelected, onPress }: ChildAvatarItemProps) {
  const selected = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    selected.value = withSpring(isSelected ? 1 : 0, {
      damping: 15,
      stiffness: 180,
    });
  }, [isSelected, selected]);

  const ringStyle = useAnimatedStyle(() => ({
    borderWidth: interpolate(selected.value, [0, 1], [0, RING_WIDTH]),
    borderColor: colors.primary.amber,
    transform: [
      { scale: interpolate(selected.value, [0, 1], [0.92, 1]) },
    ],
  }));

  return (
    <View style={styles.itemContainer}>
      <AnimatedPressable
        onPress={onPress}
        style={[styles.avatarRing, ringStyle]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${item.name}${isSelected ? ', selected' : ''}`}
      >
        <Avatar
          uri={item.avatarUrl}
          name={item.name}
          size="lg"
        />
      </AnimatedPressable>

      <Text
        variant="caption"
        color={isSelected ? colors.primary.amberDark : colors.text.secondary}
        numberOfLines={1}
        style={[
          styles.nameLabel,
          isSelected && styles.nameLabelSelected,
        ]}
      >
        {item.name}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * `<ChildSwitcher>` -- horizontal scroll of circular avatars for switching
 * between children.
 *
 * The active child shows an amber border ring and slightly larger scale.
 * Uses a `FlatList` with horizontal mode and snap-to-item behaviour.
 *
 * ```tsx
 * <ChildSwitcher
 *   children={childrenList}
 *   selectedId={activeChildId}
 *   onSelect={(child) => setActiveChildId(child.id)}
 * />
 * ```
 */
export function ChildSwitcher({
  children: childrenList,
  selectedId,
  onSelect,
}: ChildSwitcherProps) {
  const flatListRef = useRef<FlatList<ChildItem>>(null);

  const handleSelect = useCallback(
    (child: ChildItem) => {
      onSelect(child);

      // Scroll the selected item into view
      const index = childrenList.findIndex((c) => c.id === child.id);
      if (index !== -1) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // center
        });
      }
    },
    [childrenList, onSelect],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChildItem>) => (
      <ChildAvatarItem
        item={item}
        isSelected={item.id === selectedId}
        onPress={() => handleSelect(item)}
      />
    ),
    [selectedId, handleSelect],
  );

  const keyExtractor = useCallback((item: ChildItem) => item.id, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  if (childrenList.length === 0) return null;

  return (
    <FlatList
      ref={flatListRef}
      data={childrenList}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      snapToInterval={ITEM_WIDTH}
      decelerationRate="fast"
      getItemLayout={getItemLayout}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  avatarRing: {
    width: AVATAR_SIZE + RING_WIDTH * 2 + 4,
    height: AVATAR_SIZE + RING_WIDTH * 2 + 4,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  nameLabel: {
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: ITEM_WIDTH - spacing.xs,
  },
  nameLabelSelected: {
    fontWeight: '600',
  },
});

export default ChildSwitcher;
