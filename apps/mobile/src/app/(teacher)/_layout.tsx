import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RoleGate } from '@/features/auth/components/RoleGate';
import { TabBar } from '@/components/navigation';

// ---------------------------------------------------------------------------
// Tab layout
// ---------------------------------------------------------------------------

/**
 * The teacher's four tabs: their class, the upload flow, alerts and profile.
 *
 * **Selection is carried by fill, never by hue.** Every icon here is the same
 * single-weight line family, and the only thing that changes when a tab is
 * chosen is that its glyph fills in — which is why the outline/solid pairs
 * below are the whole of the styling. `TabBar` hands each icon its own colour
 * (ink on the marigold puck, the muted paper tone on the ink bar), so a tab
 * never differs from its neighbour by colour alone; a filled glyph reads in
 * greyscale and to someone who cannot separate the two tones.
 *
 * `tabBarActiveTintColor` and its inactive twin used to be set here, the active
 * one to marigold. `TabBar` is a custom bar and never reads either — but
 * marigold measures 2.03:1 on paper, so the day something did read it, the
 * selected tab's icon would have become the least legible thing on screen.
 * Dead configuration that is also wrong is worth deleting twice.
 */
export default function TeacherLayout() {
  return (
    <RoleGate allow={['teacher']}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Class',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Your class tab',
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: 'Share',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? 'camera' : 'camera-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Share photos tab',
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? 'notifications' : 'notifications-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Notifications tab',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Profile tab',
          }}
        />
      </Tabs>
    </RoleGate>
  );
}
