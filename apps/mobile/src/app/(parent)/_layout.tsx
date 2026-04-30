import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { TabBar } from '@/components/navigation';

// ---------------------------------------------------------------------------
// Tab icon helper
// ---------------------------------------------------------------------------

function tabIcon(
  name: keyof typeof Ionicons.glyphMap,
  nameOutline: keyof typeof Ionicons.glyphMap,
) {
  return ({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: string;
    size: number;
  }) => (
    <Ionicons
      name={focused ? name : nameOutline}
      size={size}
      color={color}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Parent tab layout.
 *
 * Four tabs:
 * 1. **Feed** — photo feed for the parent's children.
 * 2. **Orders** — order history.
 * 3. **Alerts** — notifications.
 * 4. **Profile** — account info and sign out.
 * (photo/[id] is a stack screen, hidden from tab bar.)
 */
export default function ParentLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.amber,
        tabBarInactiveTintColor: colors.text.tertiary,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: tabIcon('images', 'images-outline'),
          tabBarAccessibilityLabel: 'Photo Feed',
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: tabIcon('cart', 'cart-outline'),
          tabBarAccessibilityLabel: 'Order History',
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: tabIcon('notifications', 'notifications-outline'),
          tabBarAccessibilityLabel: 'Notifications',
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person', 'person-outline'),
          tabBarAccessibilityLabel: 'Profile',
        }}
      />

      {/* Hidden: detail screen when tapping a photo */}
      <Tabs.Screen
        name="photo/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
