import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RoleGate } from '@/features/auth/components/RoleGate';
import { TabBar } from '@/components/navigation';

// ---------------------------------------------------------------------------
// Tab icon helper
// ---------------------------------------------------------------------------

function tabIcon(
  name: keyof typeof Ionicons.glyphMap,
  nameFocused: keyof typeof Ionicons.glyphMap,
) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? nameFocused : name} size={size} color={color} />
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Admin tab layout — six tabs: Home, Users, Schools, Orders, Alerts, Profile.
 *
 * The tint options that used to sit in `screenOptions` are gone rather than
 * corrected. `TabBar` paints its own two states — ink on the marigold puck at
 * 8.08:1, the muted paper tone on the ink bar at 7.63:1 — so the values here
 * were never read; the active one was `primary.amber`, which measures 2.03:1
 * and cannot legally colour an icon that has to be read. A dead prop naming a
 * forbidden colour is a trap for whoever wires the next tab group.
 */
export default function AdminLayout() {
  return (
    <RoleGate allow={['admin']}>
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          // 'Dashboard' is nine characters in a six-tab bar; at phone width it
          // ellipsized to 'Dashboa…'. The screen is headed 'Overview' anyway,
          // so the tab does not need to repeat the long form.
          title: 'Home',
          tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart'),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: tabIcon('people-outline', 'people'),
        }}
      />
      <Tabs.Screen
        name="schools"
        options={{
          title: 'Schools',
          tabBarIcon: tabIcon('school-outline', 'school'),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: tabIcon('receipt-outline', 'receipt'),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-outline', 'person'),
        }}
      />

      {/* Hidden: class detail screen pushed from schools tab */}
      <Tabs.Screen
        name="class-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </RoleGate>
  );
}
