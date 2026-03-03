import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, spacing, layout } from '@/theme';
import { Text, Button } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { useAuthStore } from '@/features/auth/stores/authStore';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher Profile screen — shows current user info and sign out.
 * Fourth tab in the teacher tab bar (Dashboard, Upload, Notifications, Profile).
 */
export default function TeacherProfileScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useAuthStore();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/login' as never);
  }, [signOut, router]);

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const email = user?.email ?? '';

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Profile" />
      <View style={styles.content}>
        <Avatar
          uri={profile?.avatar_url}
          name={displayName}
          size="lg"
          style={styles.avatar}
        />
        <Text variant="h3" style={styles.name}>
          {displayName}
        </Text>
        <Text variant="body" color={colors.text.secondary} style={styles.email}>
          {email}
        </Text>
        {profile?.role && (
          <View style={styles.roleBadge}>
            <Text variant="caption" color={colors.primary.amberDark}>
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </Text>
          </View>
        )}

        <Button
          variant="outline"
          size="lg"
          onPress={handleSignOut}
          style={styles.signOut}
        >
          Sign out
        </Button>
      </View>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  avatar: {
    marginBottom: spacing.md,
  },
  name: {
    marginBottom: spacing.xs,
  },
  email: {
    marginBottom: spacing.sm,
  },
  roleBadge: {
    backgroundColor: colors.primary.amberLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: layout.buttonRadius,
    marginBottom: spacing.xxl,
  },
  signOut: {
    width: '100%',
    maxWidth: 280,
    borderRadius: layout.buttonRadius,
  },
});
