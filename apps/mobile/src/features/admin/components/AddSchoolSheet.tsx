import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import type { CreateSchoolData } from '@/features/admin/services/adminService';
import { Modal } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddSchoolSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the school data when the form is submitted. */
  onSubmit: (data: CreateSchoolData) => void;
  /** Whether submission is in progress. */
  isSubmitting?: boolean;
  /**
   * Existing values to edit. When present the sheet switches to edit mode:
   * same fields, same validation, different title and button label. A school's
   * details could previously be set once at creation and never corrected.
   */
  initialValues?: CreateSchoolData | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<AddSchoolSheet>` -- a bottom sheet form for creating or editing a school.
 *
 * Fields: name (required), address (optional), phone (optional).
 */
export function AddSchoolSheet({
  isVisible,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialValues = null,
}: AddSchoolSheetProps) {
  const isEditing = initialValues != null;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  // Re-seed every time the sheet opens, so a cancelled edit does not leak into
  // the next school the admin opens.
  useEffect(() => {
    if (isVisible) {
      setName(initialValues?.name ?? '');
      setAddress(initialValues?.address ?? '');
      setPhone(initialValues?.phone ?? '');
      setNameError(undefined);
    }
  }, [isVisible, initialValues]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('School name is required');
      return;
    }

    setNameError(undefined);
    onSubmit({
      name: trimmedName,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  }, [name, address, phone, onSubmit]);

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
              <Text variant="h3" style={styles.title}>
                {isEditing ? 'Edit School' : 'Add School'}
              </Text>

              <TextInput
                label="School Name"
                placeholder="e.g. Sunshine Preschool"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError(undefined);
                }}
                error={nameError}
                autoCapitalize="words"
                containerStyle={styles.field}
              />

              <TextInput
                label="Address"
                placeholder="123 Main St, City, State"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
                containerStyle={styles.field}
              />

              <TextInput
                label="Phone"
                placeholder="(555) 123-4567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                containerStyle={styles.field}
              />

              <Button
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!name.trim()}
                style={styles.submitButton}
              >
                {isEditing ? 'Save Changes' : 'Create School'}
              </Button>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
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
  title: {
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  submitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});

export default AddSchoolSheet;
