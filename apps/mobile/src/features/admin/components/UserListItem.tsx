import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { AdminUser } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserListItemProps {
  /** The user to display. */
  user: AdminUser;
  /** Called when the row is pressed. */
  onPress: (user: AdminUser) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_BADGE_VARIANT: Record<UserRole, BadgeVariant> = {
  admin: 'error',
  teacher: 'default',
  parent: 'success',
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  parent: 'Parent',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UserListItem>` -- a pressable row displaying a user's avatar, name,
 * email, and role badge.
 *
 * ```tsx
 * <UserListItem user={user} onPress={openEdit} />
 * ```
 */
export function UserListItem({ user, onPress }: UserListItemProps) {
  return (
    <Pressable
      onPress={() => onPress(user)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${user.full_name}`}
    >
      <Avatar
        uri={user.avatar_url}
        name={user.full_name}
        size="md"
      />

      <View style={styles.info}>
        <Text variant="bodyBold" numberOfLines={1}>
          {user.full_name}
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          numberOfLines={1}
        >
          {user.email}
        </Text>
      </View>

      <Badge variant={ROLE_BADGE_VARIANT[user.role]}>
        {ROLE_LABEL[user.role]}
      </Badge>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.gray[50],
  },
  info: {
    flex: 1,
    gap: 2,
  },
});

export default UserListItem;
