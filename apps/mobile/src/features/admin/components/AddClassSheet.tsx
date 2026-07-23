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
import type { CreateClassData } from '@/features/admin/services/adminService';
import { Modal } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddClassSheetProps {
  isVisible: boolean;
  schoolName: string;
  onClose: () => void;
  onSubmit: (data: CreateClassData) => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sheet form for adding a class to a school. Fields: name (required), grade (optional).
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
      setNameError('Class name is required');
      return;
    }
    setNameError(undefined);
    onSubmit({
      name: trimmedName,
      grade: grade.trim() || undefined,
    });
  }, [name, grade, onSubmit]);

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
                Add Class
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.schoolLabel}>
                to {schoolName}
              </Text>

              <TextInput
                label="Class Name"
                placeholder="e.g. Morning Star, Pre-K A"
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
                label="Grade (optional)"
                placeholder="e.g. Pre-K, K"
                value={grade}
                onChangeText={setGrade}
                autoCapitalize="words"
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
                Create Class
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
  schoolLabel: {
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

export default AddClassSheet;
