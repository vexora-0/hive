import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, ANIMATION_DURATION } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import type { AdminSchool } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchoolCardProps {
  /** The school data to display. */
  school: AdminSchool;
  /** Called when the card header is pressed. Used to edit the school. */
  onPress?: (school: AdminSchool) => void;
  /** Called when "Add class" is pressed. */
  onAddClass?: (school: AdminSchool) => void;
  /** Called when a class item is pressed. */
  onClassPress?: (classId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SchoolCard>` -- a card showing school details with an expandable section
 * that reveals the class list.
 *
 * ```tsx
 * <SchoolCard school={school} onPress={navigateToSchool} />
 * ```
 */
export function SchoolCard({ school, onPress, onAddClass, onClassPress }: SchoolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
    rotation.value = withTiming(expanded ? 0 : 1, {
      duration: ANIMATION_DURATION,
    });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const handlePress = useCallback(() => {
    onPress?.(school);
  }, [onPress, school]);

  return (
    <Card style={styles.card}>
      {/* Header */}
      <Pressable
        onPress={handlePress}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={onPress ? `Edit ${school.name}` : school.name}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="school" size={22} color={colors.text.accent} />
        </View>

        <View style={styles.headerInfo}>
          <Text variant="bodyBold" numberOfLines={1}>
            {school.name}
          </Text>
          {school.address && (
            <Text
              variant="bodySmall"
              color={colors.text.secondary}
              numberOfLines={1}
            >
              {school.address}
            </Text>
          )}
        </View>

        {/* Only shown when the card is actually editable — otherwise the
            header is not pressable and a pencil would be a lie. */}
        {onPress && (
          <Ionicons
            name="create-outline"
            size={18}
            color={colors.text.tertiary}
          />
        )}
      </Pressable>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatPill
          icon="layers-outline"
          value={school._count.classes}
          label="Classes"
        />
        <StatPill
          icon="people-outline"
          value={school._count.students}
          label="Students"
        />
        <StatPill
          icon="school-outline"
          value={school._count.teachers}
          label="Teachers"
        />
      </View>

      {/* Add class button */}
      <Pressable
        onPress={() => onAddClass?.(school)}
        style={styles.addClassButton}
        accessibilityRole="button"
        accessibilityLabel="Add class to this school"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.text.accent} />
        <Text variant="bodySmallBold" color={colors.text.accent}>
          Add class
        </Text>
      </Pressable>

      {/* Expandable toggle */}
      {school.classes.length > 0 && (
        <>
          <Pressable
            onPress={toggleExpand}
            style={styles.expandToggle}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse class list' : 'Expand class list'}
          >
            <Text variant="bodySmallBold" color={colors.text.accent}>
              {expanded ? 'Hide classes' : `View ${school.classes.length} classes`}
            </Text>
            <Animated.View style={chevronStyle}>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.text.accent}
              />
            </Animated.View>
          </Pressable>

          {expanded && (
            <View style={styles.classList}>
              {school.classes.map((cls) => (
                <Pressable
                  key={cls.id}
                  style={styles.classItem}
                  onPress={() => onClassPress?.(cls.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${cls.name} class`}
                >
                  <Ionicons
                    name="book-outline"
                    size={16}
                    color={colors.text.tertiary}
                  />
                  <Text variant="bodySmall" color={colors.text.secondary} style={{ flex: 1 }}>
                    {cls.name}
                    {cls.grade ? ` (${cls.grade})` : ''}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.text.tertiary}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// StatPill sub-component
// ---------------------------------------------------------------------------

function StatPill({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={colors.text.tertiary} />
      <Text variant="captionBold" color={colors.text.primary}>
        {value}
      </Text>
      <Text variant="caption" color={colors.text.tertiary}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.background.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.amber + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.surfaceSecondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.primary.amber + '15',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  classList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});

export default SchoolCard;
