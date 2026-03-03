import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import type { CreateStudentData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddStudentSheetProps {
  isVisible: boolean;
  schoolId: string;
  classId: string;
  className: string;
  onClose: () => void;
  onSubmit: (data: CreateStudentData) => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
      setNameError('Student name is required');
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
                Add Student
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
                to {className}
              </Text>

              <TextInput
                label="Student Name"
                placeholder="e.g. Emma Thompson"
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
                label="Date of Birth (optional)"
                placeholder="YYYY-MM-DD"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                keyboardType="numbers-and-punctuation"
                containerStyle={styles.field}
              />

              <Button
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!fullName.trim()}
                style={styles.submitButton}
              >
                Add Student
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
    marginBottom: spacing.xs,
  },
  subtitle: {
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
