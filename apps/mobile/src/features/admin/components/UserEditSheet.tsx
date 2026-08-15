import React, { useCallback, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { BottomSheet, ConfirmDialog } from '@/components/feedback';
import type { AdminUser, AdminSchool } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What the admin changed. Absent keys were not touched. */
export interface UserChanges {
  role?: UserRole;
  schoolId?: string | null;
}

export interface UserEditSheetProps {
  /** The person being edited, or null when hidden. */
  user: AdminUser | null;
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** Schools available to assign to. */
  schools: AdminSchool[];
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /**
   * Applies both changes in one press.
   *
   * There used to be two buttons — Save Role and Assign School — each firing
   * its own mutation and each closing the sheet, so changing both meant two
   * round trips, two toasts, and a sheet that shut before the second one
   * landed. One decision, one action.
   */
  onSave: (userId: string, changes: UserChanges) => void | Promise<void>;
  /** Whether a save is in flight. */
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'parent', label: 'Parent' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_LABEL: Record<UserRole, string> = {
  parent: 'Parent',
  teacher: 'Teacher',
  admin: 'Admin',
};

/** What each role can reach, said plainly rather than as a permission matrix. */
const ROLE_NOTE: Record<UserRole, string> = {
  parent: 'Sees photographs of their own children, and orders prints of them.',
  teacher: 'Uploads and tags photographs for the classes they are assigned.',
  admin: 'Manages every school, every person and every order on Hive.',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UserEditSheet>` — the two things an admin can change about a person from a
 * phone: what they are, and where they belong.
 *
 * Everything else about an account — the name, the email address, the
 * photograph, deactivation — is deliberately absent. Those are desk work, and
 * a companion app that offers every field a web console offers is just a small
 * web console.
 *
 * Three roles is exactly what a `SegmentedControl` is for, so the hand-rolled
 * radio list is gone: three bordered rows with their own amber tint, three
 * icons and three radio circles, to express one choice from three. The note
 * under the control changes with the selection, because "Admin" means nothing
 * to someone who has not read the permissions table.
 *
 * **The confirmation is spent where it counts.** A role change is reversible —
 * change it back — so under the brief's own rule it does not earn a dialog.
 * Promotion *to admin* is the exception: it hands over every school on the
 * platform, and the person doing it should have to say so twice.
 */
export function UserEditSheet({
  user,
  isVisible,
  schools,
  onClose,
  onSave,
  isSaving = false,
}: UserEditSheetProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('teacher');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  /** True while a promotion to admin awaits confirmation. */
  const [confirmingAdmin, setConfirmingAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedSchoolId(user.school_id);
      setConfirmingAdmin(false);
    }
  }, [user]);

  const roleChanged = user ? selectedRole !== user.role : false;
  const schoolChanged = user ? selectedSchoolId !== user.school_id : false;
  const dirty = roleChanged || schoolChanged;

  const commit = useCallback(() => {
    if (!user) return;
    onSave(user.id, {
      ...(roleChanged ? { role: selectedRole } : null),
      ...(schoolChanged ? { schoolId: selectedSchoolId } : null),
    });
  }, [user, onSave, roleChanged, schoolChanged, selectedRole, selectedSchoolId]);

  const handleSave = useCallback(() => {
    if (roleChanged && selectedRole === 'admin') {
      setConfirmingAdmin(true);
      return;
    }
    commit();
  }, [roleChanged, selectedRole, commit]);

  const confirmAdmin = useCallback(() => {
    setConfirmingAdmin(false);
    commit();
  }, [commit]);

  if (!user) return null;

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      scroll
      showClose
      footer={
        <Button
          fullWidth
          onPress={handleSave}
          loading={isSaving}
          disabled={!dirty}
          accessibilityHint={
            dirty ? 'Applies the changes to this person' : undefined
          }
        >
          {dirty ? 'Save changes' : 'Nothing to save'}
        </Button>
      }
    >
      {/* ── Who this is ──────────────────────────────────────────── */}
      <View style={styles.identity}>
        <Avatar uri={user.avatar_url} name={user.full_name} size="lg" />
        <View style={styles.identityText}>
          <Text variant="h3" numberOfLines={1}>
            {user.full_name}
          </Text>
          <Text variant="bodySmall" muted numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      {/* ── Role ─────────────────────────────────────────────────── */}
      <SectionHeader size="sm" title="Role" style={styles.sectionHeader} />

      <SegmentedControl
        options={ROLE_OPTIONS}
        value={selectedRole}
        onChange={setSelectedRole}
        accessibilityLabel="Role"
      />

      <Text variant="bodySmall" muted style={styles.roleNote}>
        {ROLE_NOTE[selectedRole]}
      </Text>

      {/* ── School ───────────────────────────────────────────────── */}
      <SectionHeader
        size="sm"
        title="School"
        subtitle="Teachers and admins only see the school they belong to."
        style={styles.sectionHeader}
      />

      <View style={styles.schoolList}>
        <SchoolOption
          label="No school"
          selected={selectedSchoolId === null}
          onPress={() => setSelectedSchoolId(null)}
        />

        {schools.map((school) => (
          <SchoolOption
            key={school.id}
            label={school.name}
            selected={selectedSchoolId === school.id}
            onPress={() => setSelectedSchoolId(school.id)}
          />
        ))}
      </View>

      {/* Nested, not a sibling. iOS presents a Modal from the nearest
          UIViewController up the responder chain, so a sibling presents from
          the root VC — already presenting this sheet — and UIKit silently
          refuses. See the matching note in ParentListSheet. */}
      <ConfirmDialog
        visible={confirmingAdmin}
        title="Make this person an admin?"
        message={`${user.full_name} will be able to see and change every school, every person and every order on Hive.`}
        confirmLabel="Make admin"
        destructive
        onConfirm={confirmAdmin}
        onCancel={() => setConfirmingAdmin(false)}
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// School option
//
// A selected row is marked by a tick and a recessed ground, not by a coloured
// border: the tick is the one mark that means "this one" everywhere in the app,
// and a hue would be the third thing on this sheet trying to say the same word.
// ---------------------------------------------------------------------------

function SchoolOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.schoolOption,
        selected && styles.schoolOptionSelected,
        pressed && styles.schoolOptionPressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <Text
        variant={selected ? 'bodyBold' : 'body'}
        numberOfLines={1}
        style={styles.schoolName}
      >
        {label}
      </Text>

      {selected && (
        <Ionicons name="checkmark" size={19} color={colors.text.accent} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: spacing.xxs,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  roleNote: {
    marginTop: spacing.sm,
  },
  schoolList: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  schoolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
  },
  schoolOptionSelected: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  schoolOptionPressed: {
    backgroundColor: colors.gray[100],
  },
  schoolName: {
    flex: 1,
  },
});

export default UserEditSheet;
