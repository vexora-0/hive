import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';
import { TabBar } from '@/components/navigation';
import { RoleGate } from '@/features/auth/components/RoleGate';

// ---------------------------------------------------------------------------
// Tab Layout
// ---------------------------------------------------------------------------

/**
 * Teacher tab layout — 4 tabs:
 * - Dashboard
 * - Upload
 * - Notifications
 * - Profile
 *
 * Gated to `teacher`, so deep-linking `hive://(teacher)/upload` as a parent or
 * admin redirects instead of rendering.
 */
export default function TeacherLayout() {
  return (
    <RoleGate allow={['teacher']}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary.amber,
          tabBarInactiveTintColor: colors.text.tertiary,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
            tabBarAccessibilityLabel: 'Dashboard tab',
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: 'Upload',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="camera-outline" size={size} color={color} />
            ),
            tabBarAccessibilityLabel: 'Upload photos tab',
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications-outline" size={size} color={color} />
            ),
            tabBarAccessibilityLabel: 'Notifications tab',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
            tabBarAccessibilityLabel: 'Profile tab',
          }}
        />
      </Tabs>
    </RoleGate>
  );
}
