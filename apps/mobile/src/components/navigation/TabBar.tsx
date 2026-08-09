import React, { useRef, useEffect, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { shadowSmall } from '@/theme/shadows';
import { Text } from '@/components/ui/Text';
import { useUnreadCount } from '@/features/notifications/hooks/useNotifications';

const TAB_HEIGHT = 64;
const PILL_HEIGHT = 40;
const PILL_BORDER_RADIUS = 20;
const MIN_TAP_SIZE = 44;

type TabRoute = BottomTabBarProps['state']['routes'][number];

/** Tab bar hidden route names (detail screens, not actual tabs). */
const HIDDEN_TAB_NAMES = ['photo/[id]', 'class-detail'];

function getVisibleRoutes(routes: TabRoute[]): TabRoute[] {
  return routes.filter(
    (route) => !HIDDEN_TAB_NAMES.includes(route.name as string),
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadCount: badgeCount } = useUnreadCount();
  const visibleRoutes = getVisibleRoutes(state.routes);
  const tabCount = visibleRoutes.length;

  const pillX = useRef(new Animated.Value(0)).current;
  const tabWidthRef = useRef(0);

  const currentRoute = state.routes[state.index];
  const visibleIndex = visibleRoutes.findIndex(
    (r: TabRoute) => r.key === currentRoute?.key,
  );
  const pillIndex = visibleIndex >= 0 ? visibleIndex : 0;

  useEffect(() => {
    if (tabWidthRef.current > 0) {
      Animated.spring(pillX, {
        toValue: pillIndex * tabWidthRef.current,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [pillIndex, pillX]);

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const containerWidth = event.nativeEvent.layout.width;
      tabWidthRef.current = tabCount > 0 ? containerWidth / tabCount : 0;
      pillX.setValue(pillIndex * tabWidthRef.current);
    },
    [tabCount, pillIndex, pillX],
  );

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
      onLayout={onLayout}
    >
      <Animated.View
        style={[styles.pill, { transform: [{ translateX: pillX }] }]}
      >
        <View style={styles.pillInner} />
      </Animated.View>

      {visibleRoutes.map((route: TabRoute, index: number) => {
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
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        const iconColor = isFocused ? colors.primary.amber : colors.text.tertiary;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            <View>
              {options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 24 })}
              {/* This tab bar is custom, so react-navigation's own
                  `tabBarBadge` is never rendered — the unread count was being
                  polled every 30 seconds and shown nowhere at all, leaving a
                  parent no way to know a photo had arrived without opening the
                  tab and looking. */}
              {badgeCount > 0 && route.name === 'notifications' && (
                <View style={styles.badge}>
                  <Text variant="tiny" color={colors.white} style={styles.badgeText}>
                    {badgeCount > 99 ? '99+' : String(badgeCount)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="tiny"
              color={isFocused ? colors.primary.amber : colors.text.tertiary}
              style={styles.label}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background.surface,
    height: TAB_HEIGHT + 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    ...shadowSmall,
  },
  pill: {
    position: 'absolute',
    top: (TAB_HEIGHT - PILL_HEIGHT) / 2,
    left: 0,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInner: {
    width: '70%',
    height: '100%',
    backgroundColor: colors.primary.amberLight + '30',
    borderRadius: PILL_BORDER_RADIUS,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    lineHeight: 18,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_SIZE,
    height: TAB_HEIGHT,
    paddingVertical: spacing.xs,
  },
  label: {
    marginTop: 2,
  },
});

export default TabBar;
