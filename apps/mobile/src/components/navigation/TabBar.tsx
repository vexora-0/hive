import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { useUnreadCount } from '@/features/notifications/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_HEIGHT = layout.tabBarHeight;
const PUCK_SIZE = 38;
/**
 * Where the icon's centre lands inside the bar, given the tab's own padding
 * and gap below. The puck is centred on the same point rather than on the bar,
 * so it sits behind the icon and not behind the icon-and-label pair.
 */
const ICON_CENTER_Y = 24;

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

  // Tab width is only known after layout, so the puck stays hidden until then
  // rather than flashing at x=0 and sliding into place on first paint.
  const [tabWidth, setTabWidth] = useState(0);
  const puckX = useSharedValue(0);
  const puckReady = useSharedValue(0);

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = activeIndex * tabWidth + (tabWidth - PUCK_SIZE) / 2;
    if (puckReady.value === 0) {
      puckX.value = target;
      puckReady.value = withTiming(1, timing(duration.fast));
    } else {
      puckX.value = withSpring(target, spring.snappy);
    }
  }, [activeIndex, tabWidth, puckX, puckReady]);

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const width = event.nativeEvent.layout.width;
      setTabWidth(tabCount > 0 ? width / tabCount : 0);
    },
    [tabCount],
  );

  const puckStyle = useAnimatedStyle(() => ({
    opacity: puckReady.value,
    transform: [{ translateX: puckX.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.ms) }]}
    >
      <View style={styles.bar} onLayout={onLayout}>
        <Animated.View style={[styles.puck, puckStyle]} />

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
  // enough to feel like weight shifting rather than an element resizing.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * 1.5 },
      { scale: 1 + lift.value * 0.06 },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        {icon?.({
          focused,
          color: focused ? colors.ink[900] : colors.text.onInkMuted,
          size: 22,
        })}
        {badgeCount > 0 && (
          <View style={styles.badge}>
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
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.large),
  },
  puck: {
    position: 'absolute',
    top: ICON_CENTER_Y - PUCK_SIZE / 2,
    left: 0,
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: PUCK_SIZE / 2,
    backgroundColor: colors.primary.amber,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_SIZE,
    height: BAR_HEIGHT,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs + 2,
    gap: 3,
  },
  label: {
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
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
