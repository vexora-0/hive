import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import {
  colors,
  spacing,
  radius,
  layout,
  shadows,
  platformShadow,
  spring,
  duration,
  timing,
  hexPoints,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { useUnreadCount } from '@/features/notifications/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_HEIGHT = layout.tabBarHeight;
const ICON_SIZE = 22;
const LABEL_LINE = 13;
const TAB_PAD_TOP = spacing.sm;
const TAB_PAD_BOTTOM = spacing.xs + 2;
/**
 * Clearance between icon and label.
 *
 * The puck is a circle drawn around a 22px icon, so it reaches
 * (PUCK_SIZE - ICON_SIZE) / 2 below the icon. The gap has to exceed that or
 * the puck sits on top of the label — which it did: a 38px puck reached 8px
 * past a 22px icon into a 3px gap, overlapping the text by 5px.
 */
const ICON_LABEL_GAP = 8;
const PUCK_SIZE = 32;
/**
 * How far the icon rises as it takes the puck.
 *
 * Small enough to read as weight shifting rather than as an element moving —
 * and shared with the puck's own offset below, because a puck centred on where
 * the icon *would have been* leaves 6.5px of marigold above the glyph and
 * 3.5px below it. That asymmetry is the same defect three separate commits
 * chased, one step smaller.
 */
const FOCUS_RISE = 1.5;
/**
 * Horizontal padding on the bar itself.
 *
 * The bar is a pill, so its corners curve inward. Without this the first and
 * last tabs are drawn against the curve. The puck maths below has to account
 * for it too — see `onLayout`.
 */
const BAR_PAD_H = spacing.sm;

/**
 * Where the icon's centre lands inside the bar.
 *
 * Derived rather than hardcoded. It has to track the padding, gap and label
 * height exactly, and the previous fixed value silently stopped matching them.
 */
const CONTENT_HEIGHT = ICON_SIZE + ICON_LABEL_GAP + LABEL_LINE;
const ICON_CENTER_Y =
  TAB_PAD_TOP +
  (BAR_HEIGHT - TAB_PAD_TOP - TAB_PAD_BOTTOM - CONTENT_HEIGHT) / 2 +
  ICON_SIZE / 2;

type TabRoute = BottomTabBarProps['state']['routes'][number];

/** Routes that live inside a tab group but are not themselves tabs. */
const HIDDEN_TAB_NAMES = ['photo/[id]', 'class-detail'];

function getVisibleRoutes(routes: TabRoute[]): TabRoute[] {
  return routes.filter((route) => !HIDDEN_TAB_NAMES.includes(route.name as string));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<TabBar>` — the app's floating navigation bar.
 *
 * An ink slab lifted off the page, inset from the screen edges, with a
 * marigold puck that springs between tabs. Making the bar dark is what stops
 * the whole app reading as one flat cream sheet: it gives the page an edge to
 * end at, and it is the only large dark shape in the parent's day.
 *
 * **The puck is a surface, so what sits on it is ink** — `#181A24` on `#F0A03A`
 * measures 8.08:1, where marigold as a *label* would measure 2.03:1 and be
 * unreadable. The bar keeps `ink.900` rather than the viewer's near-neutral
 * ground: that one is reserved for surrounds that hold a photograph, where a
 * tinted surround shifts the picture's apparent white balance.
 *
 * The puck **animates x only.** Animating its width at the same time is what
 * clipped the first and last labels, and `spring.snappy` (ζ=0.91, ~220ms) is
 * tuned to arrive under the destination icon and stop rather than overshoot
 * and come back — a tab switch happens many times a day and gets a ≤200ms
 * budget, not a flourish.
 *
 * The unread count is rendered here rather than through react-navigation's
 * `tabBarBadge`, which this custom bar never draws.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadCount: badgeCount } = useUnreadCount();

  const visibleRoutes = getVisibleRoutes(state.routes);
  const tabCount = visibleRoutes.length;

  const currentRoute = state.routes[state.index];
  const visibleIndex = visibleRoutes.findIndex((r) => r.key === currentRoute?.key);
  const activeIndex = visibleIndex >= 0 ? visibleIndex : 0;

  // A hidden route is a full-screen destination, not a tab. `href: null` keeps
  // it out of the tab list but still draws the bar over it, which left the
  // photo viewer with a navigation bar and a stray puck across the image.
  const onHiddenRoute = HIDDEN_TAB_NAMES.includes(currentRoute?.name as string);

  // Tab width is only known after layout, so the puck stays hidden until then
  // rather than flashing at x=0 and sliding into place on first paint.
  const [tabWidth, setTabWidth] = useState(0);
  const lastTabWidth = useRef(0);
  const puckX = useSharedValue(0);
  const puckReady = useSharedValue(0);

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = BAR_PAD_H + activeIndex * tabWidth + (tabWidth - PUCK_SIZE) / 2;
    const resized = lastTabWidth.current !== tabWidth;
    lastTabWidth.current = tabWidth;

    if (puckReady.value === 0) {
      // First layout: place it, then fade it in. Opacity is a timing, never a
      // spring — `withSpring` under ζ<1 clamps at 1.0 and visibly stalls.
      puckX.value = target;
      puckReady.value = withTiming(1, timing(duration.fast));
    } else if (resized) {
      // A rotation or a split-screen resize is not a selection change: there
      // is nothing to follow, so the puck is placed rather than thrown across
      // a bar that has just changed size underneath it.
      puckX.value = target;
    } else {
      puckX.value = withSpring(target, spring.snappy);
    }
  }, [activeIndex, tabWidth, puckX, puckReady]);

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      // layout.width is the bar's full width, padding included, but the tabs
      // share only the space inside that padding. Dividing the full width put
      // the puck ~7px left of the icon it sits behind, which on the first tab
      // pushed it onto the pill's rounded corner.
      const content = event.nativeEvent.layout.width - BAR_PAD_H * 2;
      setTabWidth(tabCount > 0 ? content / tabCount : 0);
    },
    [tabCount],
  );

  const puckStyle = useAnimatedStyle(() => ({
    opacity: puckReady.value,
    transform: [{ translateX: puckX.value }],
  }));

  if (onHiddenRoute) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.ms) }]}
    >
      <View style={styles.bar} onLayout={onLayout} accessibilityRole="tablist">
        {/* The puck is a comb cell, not a circle.
            It is the fourth place the same flat-top hexagon appears — after the
            app mark, the onboarding page indicator and the confetti — and that
            repetition is what turns a shape into a brand. It costs nothing: the
            geometry comes from `hexPoints`, the same function all four use, so
            they cannot drift apart. */}
        <Animated.View style={[styles.puck, puckStyle]}>
          <Svg width={PUCK_SIZE} height={PUCK_SIZE} viewBox="0 0 100 100">
            <Polygon
              points={hexPoints(50, 50, 48)}
              fill={colors.primary.amber}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isFocused = state.index === state.routes.indexOf(route);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              // `onPress` fires at finger-lift, which is where the selection
              // haptic belongs: it lands with the puck leaving, not while the
              // finger is still deciding.
              Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Tab
              key={route.key}
              label={label}
              focused={isFocused}
              badgeCount={route.name === 'notifications' ? badgeCount : 0}
              icon={options.tabBarIcon}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// One tab
// ---------------------------------------------------------------------------

interface TabProps {
  label: string;
  focused: boolean;
  badgeCount: number;
  icon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
}

function Tab({
  label,
  focused,
  badgeCount,
  icon,
  accessibilityLabel,
  onPress,
  onLongPress,
}: TabProps) {
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, spring.snappy);
  }, [focused, lift]);

  // The icon rises a couple of pixels and grows as it takes the puck — small
  // enough to feel like weight shifting rather than an element resizing. Both
  // are transforms, which is the only thing a spring may drive.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * FOCUS_RISE },
      { scale: 1 + lift.value * 0.06 },
    ],
  }));

  // A dot is invisible to a screen reader, so the count is said out loud.
  const spokenLabel = accessibilityLabel ?? label;
  const a11yLabel =
    badgeCount > 0 ? `${spokenLabel}, ${badgeCount} unread` : spokenLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        {icon?.({
          focused,
          // Ink on the marigold puck (8.08:1); the muted paper tone on the ink
          // bar (7.63:1). Fill versus line is the icon's own job — hue never
          // differentiates a tab.
          color: focused ? colors.ink[900] : colors.text.onInkMuted,
          size: ICON_SIZE,
        })}
        {badgeCount > 0 && (
          <View
            style={[
              styles.badge,
              // The ring separates the badge from whatever is behind it, so it
              // has to be that thing's colour. It was always ink — right on the
              // dark bar, wrong on the focused tab, where the badge sits on the
              // marigold puck and an ink ring cut a visible bite out of it.
              // Compare the notifications tab against any other while it is
              // selected and carrying a count.
              { borderColor: focused ? colors.primary.amber : colors.ink[900] },
            ]}
          >
            <Text variant="tiny" color={colors.white} style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : String(badgeCount)}
            </Text>
          </View>
        )}
      </Animated.View>

      <Text
        variant="tiny"
        color={focused ? colors.text.onInk : colors.text.onInkMuted}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.tabBarInset,
    backgroundColor: colors.transparent,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: radius.xxl,
    // The bar is a pill, so its corners curve inward to roughly 4px from the
    // edge at the label's height. Without this the first and last labels are
    // drawn outside the shape and clip against the curve.
    paddingHorizontal: BAR_PAD_H,
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.large),
  },
  puck: {
    position: 'absolute',
    // Centred on the icon's *lifted* position, because the puck only ever sits
    // under a focused icon and a focused icon is FOCUS_RISE px higher.
    top: ICON_CENTER_Y - FOCUS_RISE - PUCK_SIZE / 2,
    left: 0,
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    // No `borderRadius` and no `backgroundColor`: the shape is the polygon
    // inside. Leaving a circular background behind a hexagon is how you end up
    // with a hexagon on a circle.
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_SIZE,
    height: BAR_HEIGHT,
    paddingTop: TAB_PAD_TOP,
    paddingBottom: TAB_PAD_BOTTOM,
    paddingHorizontal: 2,
    gap: ICON_LABEL_GAP,
    // Lets the tab shrink below its label's intrinsic width, so a long label
    // ellipsizes inside its own slot instead of spilling past the bar.
    minWidth: 0,
    overflow: 'hidden',
  },
  label: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.error.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink[900],
  },
  badgeText: {
    lineHeight: 14,
  },
});

export default TabBar;
