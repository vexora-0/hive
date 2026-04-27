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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapParentSheetProps {
  isVisible: boolean;
  studentName: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapParentSheet({
  isVisible,
  studentName,
  onClose,
  onSubmit,
  isSubmitting = false,
  error,
}: MapParentSheetProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();

  useEffect(() => {
    if (isVisible) {
      setEmail('');
      setEmailError(undefined);
    }
  }, [isVisible]);

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email');
      return;
    }
    setEmailError(undefined);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      // error is displayed via the error prop
    }
  }, [email, onSubmit, onClose]);

  const displayError = emailError || (error ? error.message : undefined);

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
                Map Parent
              </Text>
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
                to {studentName}
              </Text>

              <TextInput
                label="Parent Email"
                placeholder="parent@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError(undefined);
                }}
                error={displayError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                containerStyle={styles.field}
              />

              <Text variant="bodySmall" color={colors.text.secondary} style={styles.hint}>
                The parent must have signed up first. Enter their email to link them to this student.
              </Text>

              <Button
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!email.trim()}
                style={styles.submitButton}
              >
                Map Parent
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
    marginBottom: spacing.sm,
  },
  hint: {
    marginBottom: spacing.md,
  },
  submitButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});
