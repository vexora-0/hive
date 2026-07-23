import React, { useCallback, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/feedback';
import type { AdminUser, AdminSchool } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserEditSheetProps {
  /** The user to edit, or null when hidden. */
  user: AdminUser | null;
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** List of schools for assignment picker. */
  schools: AdminSchool[];
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the updated role when the user taps Save Role. */
  onSaveRole: (userId: string, role: UserRole) => void;
  /** Called with the school id when the user taps Assign. */
  onAssignSchool: (userId: string, schoolId: string | null) => void;
  /** Whether a role save is in progress. */
  isSavingRole?: boolean;
  /** Whether a school assignment is in progress. */
  isAssigningSchool?: boolean;
}

// ---------------------------------------------------------------------------
// Role options
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'teacher', label: 'Teacher', icon: 'school-outline' },
  { value: 'parent', label: 'Parent', icon: 'people-outline' },
  { value: 'admin', label: 'Admin', icon: 'shield-outline' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserEditSheet({
  user,
  isVisible,
  schools,
  onClose,
  onSaveRole,
  onAssignSchool,
  isSavingRole = false,
  isAssigningSchool = false,
}: UserEditSheetProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('teacher');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  /** True while the role change awaits confirmation. */
  const [confirmingRole, setConfirmingRole] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedSchoolId(user.school_id);
      setConfirmingRole(false);
    }
  }, [user]);

  // A role change silently widens or narrows what someone can reach, so it
  // asks first. Saving is deferred to `confirmSaveRole`.
  const handleSaveRole = useCallback(() => {
    setConfirmingRole(true);
  }, []);

  const confirmSaveRole = useCallback(() => {
    if (user) onSaveRole(user.id, selectedRole);
    setConfirmingRole(false);
  }, [user, selectedRole, onSaveRole]);

  const handleAssignSchool = useCallback(() => {
    if (user) onAssignSchool(user.id, selectedSchoolId);
  }, [user, selectedSchoolId, onAssignSchool]);

  if (!user) return null;

  const currentSchool = schools.find((s) => s.id === user.school_id);
  const roleChanged = selectedRole !== user.role;
  const schoolChanged = selectedSchoolId !== user.school_id;

  const selectedRoleLabel =
    ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label ?? selectedRole;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handleBar} />
            <ScrollView
              style={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* User header */}
              <View style={styles.header}>
                <Avatar
                  uri={user.avatar_url}
                  name={user.full_name}
                  size="lg"
                />
                <View style={styles.headerInfo}>
                  <Text variant="h4" numberOfLines={1}>
                    {user.full_name}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
                    {user.email}
                  </Text>
                  {currentSchool && (
                    <Text variant="caption" color={colors.primary.amberDark} numberOfLines={1}>
                      {currentSchool.name}
                    </Text>
                  )}
                </View>
              </View>

              {/* Role selector */}
              <Text variant="bodyBold" style={styles.sectionLabel}>
                Role
              </Text>

              <View style={styles.roleList}>
                {ROLE_OPTIONS.map((option) => {
                  const isSelected = selectedRole === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setSelectedRole(option.value)}
                      style={[
                        styles.roleOption,
                        isSelected && styles.roleOptionSelected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Ionicons
                        name={option.icon}
                        size={20}
                        color={isSelected ? colors.primary.amber : colors.text.secondary}
                      />
                      <Text
                        variant="body"
                        color={isSelected ? colors.text.primary : colors.text.secondary}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                variant="primary"
                size="md"
                onPress={handleSaveRole}
                loading={isSavingRole}
                disabled={!roleChanged}
                style={styles.saveButton}
              >
                Save Role
              </Button>

              {/* School assignment */}
              <Text variant="bodyBold" style={styles.sectionLabel}>
                Assign to School
              </Text>

              <View style={styles.roleList}>
                {/* Unassign option */}
                <Pressable
                  onPress={() => setSelectedSchoolId(null)}
                  style={[
                    styles.roleOption,
                    selectedSchoolId === null && styles.roleOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      selectedSchoolId === null && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedSchoolId === null && <View style={styles.radioInner} />}
                  </View>
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={selectedSchoolId === null ? colors.primary.amber : colors.text.secondary}
                  />
                  <Text
                    variant="body"
                    color={selectedSchoolId === null ? colors.text.primary : colors.text.secondary}
                  >
                    No School
                  </Text>
                </Pressable>

                {schools.map((school) => {
                  const isSelected = selectedSchoolId === school.id;
                  return (
                    <Pressable
                      key={school.id}
                      onPress={() => setSelectedSchoolId(school.id)}
                      style={[
                        styles.roleOption,
                        isSelected && styles.roleOptionSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color={isSelected ? colors.primary.amber : colors.text.secondary}
                      />
                      <Text
                        variant="body"
                        color={isSelected ? colors.text.primary : colors.text.secondary}
                        numberOfLines={1}
                        style={styles.schoolName}
                      >
                        {school.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                variant="primary"
                size="md"
                onPress={handleAssignSchool}
                loading={isAssigningSchool}
                disabled={!schoolChanged}
                style={styles.saveButton}
              >
                Assign School
              </Button>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Nested, not a sibling. iOS presents a Modal from the nearest
          UIViewController up the responder chain, so a sibling presents from
          the root VC — already presenting this sheet — and UIKit silently
          refuses. See the matching note in ParentListSheet. */}
      <ConfirmDialog
        visible={confirmingRole}
        title="Change role"
        message={`Change ${user.full_name} to ${selectedRoleLabel}? This changes what they can access.`}
        confirmLabel="Change role"
        destructive
        onConfirm={confirmSaveRole}
        onCancel={() => setConfirmingRole(false)}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  roleList: {
    gap: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.surface,
  },
  roleOptionSelected: {
    borderColor: colors.primary.amber,
    backgroundColor: colors.primary.amber + '0D',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary.amber,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.amber,
  },
  schoolName: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});

export default UserEditSheet;
