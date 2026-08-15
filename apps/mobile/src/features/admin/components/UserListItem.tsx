import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { AdminUser } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserListItemProps {
  /** The person this row is about. */
  user: AdminUser;
  /**
   * The name of the school they belong to, where the screen knows it.
   * `school_id` alone is a UUID, and a UUID in a list row is the failure this
   * whole row exists to avoid.
   */
  schoolName?: string;
  /** Called when the row is pressed. */
  onPress: (user: AdminUser) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  parent: 'Parent',
};

/** How new an account has to be for the row to mention when it arrived. */
const RECENT_DAYS = 14;

/**
 * "Joined 3 days ago", or nothing at all.
 *
 * A creation date on every row is a table export's `created_at` column with
 * the header removed. It only says something while it is news, so it is shown
 * for a fortnight and then goes quiet.
 */
function joinedLine(iso: string): string | null {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0 || days > RECENT_DAYS) return null;
  if (days === 0) return 'Joined today';
  if (days === 1) return 'Joined yesterday';
  return `Joined ${days} days ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UserListItem>` — one person in the admin's list of people.
 *
 * The row leads with the person: their photograph, or their initials on the
 * wash their name always gets, and then their name in full. Everything else is
 * demoted a step — the email and the school they belong to sit in secondary
 * ink underneath, and the role is a single neutral stamp at the trailing edge.
 *
 * The stamp used to be hue-coded — an admin in error red, a parent in success
 * green, a teacher in marigold — which encoded nothing except which of three
 * enum values had been stored. Colour that means "this is the third case in the
 * switch" is exactly what makes an app look like the 2015 school-admin console
 * it is trying not to be, so all three now share one neutral wash and the word
 * does the work.
 *
 * **The role stamp sits on the name's line, inside the text column.** It used
 * to be a sibling of the whole column, centred against three lines of text and
 * taking its width off every one of them: the email had 193pt to live in, which
 * is less than the demo data's own addresses need, so rows read
 * "parent.rajesh@bloom.dem…" — an address cut mid-domain, which is worse than
 * no address at all. The stamp belongs to the name anyway. Moving it there
 * gives the email the column's full 257pt and its own line, with the school and
 * the joined date demoted to the caption underneath.
 */
export function UserListItem({ user, schoolName, onPress }: UserListItemProps) {
  const joined = joinedLine(user.created_at);
  const meta = [schoolName, joined].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => onPress(user)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${user.full_name}, ${ROLE_LABEL[user.role]}${schoolName ? `, ${schoolName}` : ''}`}
      accessibilityHint="Opens their role and school"
    >
      <Avatar uri={user.avatar_url} name={user.full_name} size="md" />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          {/* `flex: 1` so a long name truncates rather than shouldering the
              stamp off the row. */}
          <Text variant="bodyBold" numberOfLines={1} style={styles.name}>
            {user.full_name}
          </Text>

          <Badge variant="neutral">{ROLE_LABEL[user.role]}</Badge>
        </View>

        <Text variant="bodySmall" muted numberOfLines={1}>
          {user.email}
        </Text>

        {meta.length > 0 && (
          <Text variant="caption" color={colors.text.tertiary} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={17}
        color={colors.text.tertiary}
      />
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
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    paddingHorizontal: layout.screenPaddingHorizontal,
    minHeight: MIN_TAP_SIZE + spacing.md,
  },
  pressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});

export default UserListItem;
