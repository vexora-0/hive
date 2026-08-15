import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  radius,
  duration,
  timing,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import type { AdminSchool } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchoolCardProps {
  /** The school this card is about. */
  school: AdminSchool;
  /** Called when the card header is pressed. Used to edit the school. */
  onPress?: (school: AdminSchool) => void;
  /** Called when "Add a class" is pressed. */
  onAddClass?: (school: AdminSchool) => void;
  /** Called when a class is pressed. */
  onClassPress?: (classId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The school's size as one sentence rather than three pills.
 *
 * Three bordered pills, each with its own icon and its own count, is a
 * dashboard widget standing in for a line of prose. The line says the same
 * thing, reads in one pass, and leaves the card with one visual idea in it.
 */
function sizeLine(counts: AdminSchool['_count']): string {
  return [
    plural(counts.classes, 'class', 'classes'),
    plural(counts.students, 'child', 'children'),
    plural(counts.teachers, 'teacher', 'teachers'),
  ].join(' · ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SchoolCard>` — one school, and the classes inside it.
 *
 * The card leads with the school as an identity object: its initials on the
 * wash its name always gets, the same device a person's row uses, so a list of
 * schools and a list of people are recognisably the same app. Underneath, one
 * quiet line of prose says how big it is.
 *
 * What went: three tinted stat pills at `borderRadius: 8`, an "Add class"
 * button on a hand-mixed `amber + '15'` fill, and a 22pt icon circle on
 * `amber + '1A'`. All three were marigold used as a *tint* — the one thing the
 * palette says it must never be — and two of them sat at radii outside the
 * locked scale.
 */
export function SchoolCard({
  school,
  onPress,
  onAddClass,
  onClassPress,
}: SchoolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => {
      // Springs move things, timings colour them — but a rotation is a
      // transform, and this one is small enough that a curve reads cleaner
      // than a settle.
      rotation.value = withTiming(prev ? 0 : 1, timing(duration.fast));
      return !prev;
    });
  }, [rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const handlePress = useCallback(() => {
    onPress?.(school);
  }, [onPress, school]);

  const classCount = school.classes.length;

  return (
    <Card elevation="low" padding={0}>
      {/* ── The school ───────────────────────────────────────────── */}
      <Pressable
        onPress={handlePress}
        disabled={!onPress}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={school.name}
        accessibilityHint={onPress ? 'Edits this school' : undefined}
      >
        <Avatar name={school.name} size="md" />

        <View style={styles.headerInfo}>
          <Text variant="bodyBold" numberOfLines={1}>
            {school.name}
          </Text>

          {school.address && (
            <Text variant="bodySmall" muted numberOfLines={1}>
              {school.address}
            </Text>
          )}

          <Text variant="caption" color={colors.text.tertiary} numberOfLines={1}>
            {sizeLine(school._count)}
          </Text>
        </View>

        {/* Only shown when the card is actually editable — otherwise the
            header is not pressable and a pencil would be a lie. */}
        {onPress && (
          <Ionicons name="create-outline" size={18} color={colors.text.tertiary} />
        )}
      </Pressable>

      <Divider inset={spacing.md} />

      {/* ── Its classes ──────────────────────────────────────────── */}
      <View style={styles.actions}>
        {classCount > 0 ? (
          <Pressable
            onPress={toggleExpand}
            style={styles.action}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded
                ? 'Hide the class list'
                : `Show ${plural(classCount, 'class', 'classes')}`
            }
          >
            <Text variant="bodySmallBold" color={colors.text.accent}>
              {expanded ? 'Hide classes' : `${plural(classCount, 'class', 'classes')}`}
            </Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={17} color={colors.text.accent} />
            </Animated.View>
          </Pressable>
        ) : (
          <View style={styles.action}>
            <Text variant="bodySmall" muted>
              No classes yet
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => onAddClass?.(school)}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={`Add a class to ${school.name}`}
        >
          <Ionicons name="add" size={18} color={colors.text.accent} />
          <Text variant="bodySmallBold" color={colors.text.accent}>
            Add a class
          </Text>
        </Pressable>
      </View>

      {expanded && classCount > 0 && (
        <View style={styles.classList}>
          {school.classes.map((cls) => (
            <Pressable
              key={cls.id}
              style={({ pressed }) => [
                styles.classItem,
                pressed && styles.classItemPressed,
              ]}
              onPress={() => onClassPress?.(cls.id)}
              accessibilityRole="button"
              accessibilityLabel={cls.grade ? `${cls.name}, ${cls.grade}` : cls.name}
              accessibilityHint="Opens the class, its teacher and its children"
            >
              <View style={styles.classText}>
                <Text variant="bodySmall" numberOfLines={1}>
                  {cls.name}
                </Text>
                {cls.grade && (
                  <Text variant="caption" color={colors.text.tertiary} numberOfLines={1}>
                    {cls.grade}
                  </Text>
                )}
              </View>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.text.tertiary}
              />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.md,
  },
  headerPressed: {
    backgroundColor: colors.background.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TAP_SIZE,
  },
  classList: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
  },
  classItemPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  classText: {
    flex: 1,
  },
});

export default SchoolCard;
