import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/feedback';
import type { CreateSchoolData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddSchoolSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the school's details when the form is submitted. */
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
 * `<AddSchoolSheet>` — the three things Hive needs to know about a school.
 *
 * Name, address, telephone, and nothing else: term dates, branding, billing
 * and the rest belong at a desk, and a companion app that asks for them on a
 * phone is a web form with a handle bar drawn on it.
 *
 * The sheet itself is now the app's one `BottomSheet`, which owns the scrim,
 * the radius, the handle, the safe-area inset, the keyboard inset and the
 * height ceiling. This file used to declare all six for itself, at an 85%
 * ceiling that agreed with none of the other thirteen sheets.
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
      setNameError('A school needs a name.');
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
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title={isEditing ? 'Edit this school' : 'Add a school'}
      subtitle={
        isEditing
          ? 'Corrections show everywhere the school is named.'
          : 'Its classes and children come next.'
      }
      scroll
      keyboard
      footer={
        <Button
          fullWidth
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!name.trim()}
        >
          {isEditing ? 'Save changes' : 'Add school'}
        </Button>
      }
    >
      <TextInput
        label="Name"
        placeholder="Sunshine Preschool"
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
        label="Address (optional)"
        placeholder="12 MG Road, Bengaluru"
        value={address}
        onChangeText={setAddress}
        autoCapitalize="words"
        containerStyle={styles.field}
      />

      <TextInput
        label="Phone (optional)"
        placeholder="+91 98765 43210"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        containerStyle={styles.lastField}
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.md,
  },
  lastField: {
    marginBottom: spacing.sm,
  },
});

export default AddSchoolSheet;
