import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  colors,
  spacing,
  radius,
  layout,
  spring,
  pressScale,
  MIN_TAP_SIZE,
} from '@/theme';
import { Avatar, Text } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChildItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ChildSwitcherProps {
  /** Children to switch between. */
  children: ChildItem[];
  /** Currently selected child id. */
  selectedId?: string | null;
  /** Called when a child is tapped. */
  onSelect: (child: ChildItem) => void;
}

// ---------------------------------------------------------------------------
// One child
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** First name only — the surname is the same for every row in most families. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

interface ChildPillProps {
  item: ChildItem;
  isSelected: boolean;
  onPress: () => void;
}

function ChildPill({ item, isSelected, onPress }: ChildPillProps) {
  const selected = useSharedValue(isSelected ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    selected.value = withSpring(isSelected ? 1 : 0, spring.snappy);
  }, [isSelected, selected]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selected.value,
      [0, 1],
      [colors.background.surface, colors.ink[900]],
    ),
    borderColor: interpolateColor(
      selected.value,
      [0, 1],
      [colors.border.light, colors.ink[900]],
    ),
    transform: [{ scale: press.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        if (isSelected) return;
        Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        press.value = withSpring(pressScale.button, spring.press);
      }}
      onPressOut={() => {
        press.value = withSpring(1, spring.press);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${item.name}'s photos`}
      style={[styles.pill, pillStyle]}
    >
      <Avatar
        uri={item.avatarUrl}
        name={item.name}
        size="sm"
        borderColor={isSelected ? colors.primary.amber : undefined}
        borderWidth={2}
      />
      <Text
        variant="bodySmallBold"
        color={isSelected ? colors.text.onInk : colors.text.secondary}
        numberOfLines={1}
      >
        {firstName(item.name)}
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * `<ChildSwitcher>` — picks whose photos the feed is showing.
 *
 * A row of compact pills rather than a carousel of 64px portraits. Most
 * families have one or two children, so the old carousel spent a quarter of
 * the screen above the feed to offer a choice of two — and rendered at all
 * even when there was only one child, which is a control with nothing to
 * control. It now hides itself below two.
 *
 * ```tsx
 * <ChildSwitcher children={children} selectedId={active?.id} onSelect={setActive} />
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

      const index = childrenList.findIndex((c) => c.id === child.id);
      if (index !== -1) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [childrenList, onSelect],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChildItem>) => (
      <ChildPill
        item={item}
        isSelected={item.id === selectedId}
        onPress={() => handleSelect(item)}
      />
    ),
    [selectedId, handleSelect],
  );

  const keyExtractor = useCallback((item: ChildItem) => item.id, []);

  // Nothing to switch between.
  if (childrenList.length < 2) return null;

  return (
    <FlatList
      ref={flatListRef}
      data={childrenList}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      // Pill widths vary with name length, so an estimated getItemLayout would
      // put scrollToIndex in the wrong place. Letting FlatList measure is
      // affordable here: a family has a handful of children, not hundreds.
      onScrollToIndexFailed={() => {}}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_SIZE,
    paddingLeft: spacing.xs + 1,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});

export default ChildSwitcher;
