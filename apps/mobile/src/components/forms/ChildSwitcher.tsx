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
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  colors,
  spacing,
  radius,
  layout,
  spring,
  timing,
  duration,
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
  /**
   * Currently selected child id.
   *
   * `null` — or `undefined` — means **All**: every sibling's photographs in one
   * chronological feed. Only meaningful alongside `onSelectAll`.
   */
  selectedId?: string | null;
  /** Called when a child is tapped. */
  onSelect: (child: ChildItem) => void;
  /**
   * Called when the **All** chip is tapped. The screen answers by clearing its
   * selected child and fetching every sibling's photos together.
   *
   * **The All chip renders only when this is provided.** It is optional so that
   * a screen which has not yet learned to serve a combined feed keeps working
   * unchanged rather than showing a chip that does nothing.
   */
  onSelectAll?: () => void;
  /**
   * Offers the **All** chip. @default true
   *
   * Set `false` on a surface where a merged feed makes no sense — a screen
   * scoped to one child's records, say. Has no effect without `onSelectAll`.
   */
  allowAll?: boolean;
}

// ---------------------------------------------------------------------------
// Pill physics — shared by both kinds of pill
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one pill animation, so the All chip and a child chip cannot drift apart.
 *
 * **Colour is a timing, the press is a spring.** A spring under ζ = 1 overshoots
 * its target, and `interpolateColor` clamps at 1.0 — so a spring-driven colour
 * visibly stalls at the end of its run rather than settling. Springs move
 * things; timings colour them.
 */
function usePillAnimation(isSelected: boolean) {
  const selected = useSharedValue(isSelected ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    selected.value = withTiming(isSelected ? 1 : 0, timing(duration.fast));
  }, [isSelected, selected]);

  const style = useAnimatedStyle(() => ({
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

  const onPressIn = useCallback(() => {
    press.value = withSpring(pressScale.button, spring.press);
  }, [press]);

  const onPressOut = useCallback(() => {
    press.value = withSpring(1, spring.press);
  }, [press]);

  return { style, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// One child
// ---------------------------------------------------------------------------

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
  const { style, onPressIn, onPressOut } = usePillAnimation(isSelected);

  return (
    <AnimatedPressable
      onPress={() => {
        if (isSelected) return;
        Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${item.name}'s photos`}
      style={[styles.pill, styles.childPill, style]}
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
// All
// ---------------------------------------------------------------------------

interface AllPillProps {
  isSelected: boolean;
  onPress: () => void;
}

/**
 * Every sibling's photographs in one chronological feed.
 *
 * Worth its place: the category leader makes a two-child family back out of one
 * child and drill into the other, with no combined view anywhere — so a parent
 * of siblings never sees their week as it actually happened. It costs one chip.
 *
 * No avatar and no icon. The pill is the same height and the same ink fill as
 * its neighbours, which is all the row needs to read as one control.
 */
function AllPill({ isSelected, onPress }: AllPillProps) {
  const { style, onPressIn, onPressOut } = usePillAnimation(isSelected);

  return (
    <AnimatedPressable
      onPress={() => {
        if (isSelected) return;
        Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel="Show photos of all your children"
      style={[styles.pill, styles.allPill, style]}
    >
      <Text
        variant="bodySmallBold"
        color={isSelected ? colors.text.onInk : colors.text.secondary}
        numberOfLines={1}
      >
        All
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
 * <ChildSwitcher
 *   children={children}
 *   selectedId={active?.id ?? null}
 *   onSelect={setActive}
 *   onSelectAll={() => setActive(null)}
 * />
 * ```
 */
export function ChildSwitcher({
  children: childrenList,
  selectedId,
  onSelect,
  onSelectAll,
  allowAll = true,
}: ChildSwitcherProps) {
  const flatListRef = useRef<FlatList<ChildItem>>(null);

  // A chip nobody can answer is worse than no chip, so All appears only once a
  // screen has said what to do with it.
  const showAll = allowAll && !!onSelectAll;
  const isAllSelected = selectedId == null;

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

  const handleSelectAll = useCallback(() => {
    onSelectAll?.();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [onSelectAll]);

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

  // Nothing to switch between — and nothing to merge either.
  if (childrenList.length < 2) return null;

  return (
    <FlatList
      ref={flatListRef}
      data={childrenList}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      // All rides as the list header rather than as a row, so the child
      // indices `scrollToIndex` works from stay exactly the caller's own.
      ListHeaderComponent={
        showAll ? <AllPill isSelected={isAllSelected} onPress={handleSelectAll} /> : null
      }
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
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  /** The avatar sits nearly flush with the leading edge. */
  childPill: {
    paddingLeft: spacing.xs + 1,
    paddingRight: spacing.md,
  },
  /** No avatar, so the label is centred in the pill. */
  allPill: {
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
});

export default ChildSwitcher;
