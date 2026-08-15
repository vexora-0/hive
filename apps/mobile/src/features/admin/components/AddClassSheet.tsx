import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/feedback';
import type { CreateClassData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddClassSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** The school the class is being added to — shown, never asked for. */
  schoolName: string;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the class details when the form is submitted. */
  onSubmit: (data: CreateClassData) => void;
  /** Whether submission is in progress. */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<AddClassSheet>` — a class inside a school: a name, and the year group it
 * belongs to.
 *
 * The school is stated in the subtitle rather than offered as a picker,
 * because the sheet was opened from that school's own card. Re-asking a
 * question the interface already answered is how a two-field form becomes a
 * three-field one.
 */
export function AddClassSheet({
  isVisible,
  schoolName,
  onClose,
  onSubmit,
  isSubmitting = false,
}: AddClassSheetProps) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (isVisible) {
      setName('');
      setGrade('');
      setNameError(undefined);
    }
  }, [isVisible, schoolName]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('A class needs a name.');
      return;
    }
    setNameError(undefined);
    onSubmit({
      name: trimmedName,
      grade: grade.trim() || undefined,
    });
  }, [name, grade, onSubmit]);

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title="Add a class"
      subtitle={`at ${schoolName}`}
      scroll
      keyboard
      footer={
        <Button
          fullWidth
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!name.trim()}
        >
          Add class
        </Button>
      }
    >
      <TextInput
        label="Name"
        placeholder="Sunflower"
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
        label="Year group (optional)"
        placeholder="Pre-K"
        value={grade}
        onChangeText={setGrade}
        autoCapitalize="words"
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

export default AddClassSheet;
