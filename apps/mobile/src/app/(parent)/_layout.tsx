import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { RoleGate } from '@/features/auth/components/RoleGate';
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
 * Five tabs:
 * 1. **Diary** — the child's journey, read forwards. The parent's home.
 * 2. **Moments** — the photo wall, newest first.
 * 3. **Orders** — order history.
 * 4. **Alerts** — notifications.
 * 5. **Profile** — account info and sign out.
 * (photo/[id] is a stack screen, hidden from tab bar.)
 *
 * Diary leads, and Moments is no longer the landing screen. The wall answers
 * "what arrived"; the diary answers "how has it gone", and the second is the
 * question a family keeps the app for. Both are kept — the wall is still the
 * fastest way to this afternoon, and the diary is deliberately not that.
 */
export default function ParentLayout() {
  return (
    <RoleGate allow={['parent']}>
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.amber,
        tabBarInactiveTintColor: colors.text.tertiary,
      }}
    >
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diary',
          // A bound book rather than a clock or a chart: the screen is a
          // keepsake being read, not an analytics view being consulted.
          tabBarIcon: tabIcon('book', 'book-outline'),
          tabBarAccessibilityLabel: 'Diary',
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: 'Moments',
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
    </RoleGate>
  );
}
