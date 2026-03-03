import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentCardProps {
  student: {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    avatar_url: string | null;
    parent_count: number;
  };
  onPress: (studentId: string) => void;
  onRemove: (studentId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StudentCard({ student, onPress, onRemove }: StudentCardProps) {
  return (
    <Pressable
      onPress={() => onPress(student.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={20} color={colors.text.secondary} />
      </View>

      <View style={styles.info}>
        <Text variant="bodyBold">{student.full_name}</Text>
        <View style={styles.meta}>
          <Ionicons name="people-outline" size={14} color={colors.text.secondary} />
          <Text variant="bodySmall" color={colors.text.secondary}>
            {student.parent_count} parent{student.parent_count !== 1 ? 's' : ''}
          </Text>
          {student.date_of_birth && (
            <>
              <Text variant="bodySmall" color={colors.text.secondary}> · </Text>
              <Text variant="bodySmall" color={colors.text.secondary}>
                {student.date_of_birth}
              </Text>
            </>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => onRemove(student.id)}
        hitSlop={8}
        style={styles.removeBtn}
      >
        <Ionicons name="close-circle-outline" size={22} color={colors.error.main} />
      </Pressable>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardPressed: {
    backgroundColor: colors.gray[50],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
});
