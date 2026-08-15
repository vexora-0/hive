import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/feedback';
import type { CreateStudentData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddStudentSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** The school the child is enrolled at. */
  schoolId: string;
  /** The class they join. */
  classId: string;
  /** That class's name — shown, never asked for. */
  className: string;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the child's details when the form is submitted. */
  onSubmit: (data: CreateStudentData) => void;
  /** Whether submission is in progress. */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<AddStudentSheet>` — a child joins a class.
 *
 * Two fields, one of them optional. The date of birth is worth asking for even
 * though nothing requires it: it is what lets every screen in the app say "4y
 * 2m" instead of printing a date, and an age beside a photograph is the single
 * most-loved detail in this whole category of product.
 *
 * Linking parents is deliberately *not* here. A child is created in one breath;
 * finding the right parent is a search through everyone at the school, and
 * folding a search into a creation form is how a two-field sheet becomes a
 * wizard.
 */
export function AddStudentSheet({
  isVisible,
  schoolId,
  classId,
  className,
  onClose,
  onSubmit,
  isSubmitting = false,
}: AddStudentSheetProps) {
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (isVisible) {
      setFullName('');
      setDateOfBirth('');
      setNameError(undefined);
    }
  }, [isVisible]);

  const handleSubmit = useCallback(() => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      setNameError('A child needs a name.');
      return;
    }
    setNameError(undefined);
    onSubmit({
      fullName: trimmed,
      schoolId,
      classId,
      dateOfBirth: dateOfBirth.trim() || undefined,
    });
  }, [fullName, dateOfBirth, schoolId, classId, onSubmit]);

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title="Add a child"
      subtitle={`to ${className}`}
      scroll
      keyboard
      footer={
        <Button
          fullWidth
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!fullName.trim()}
        >
          Add child
        </Button>
      }
    >
      <TextInput
        label="Name"
        placeholder="Aarav Sharma"
        value={fullName}
        onChangeText={(text) => {
          setFullName(text);
          if (nameError) setNameError(undefined);
        }}
        error={nameError}
        autoCapitalize="words"
        containerStyle={styles.field}
      />

      <TextInput
        label="Date of birth (optional)"
        placeholder="2021-06-14"
        hint="Lets the app say how old they were in a photograph."
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        keyboardType="numbers-and-punctuation"
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

export default AddStudentSheet;
