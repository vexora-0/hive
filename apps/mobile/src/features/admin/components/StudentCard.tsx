import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * A child's age, the way a parent says it: "4y 2m".
 *
 * The row used to print `date_of_birth` exactly as the database holds it —
 * `2021-06-14` — which is a machine timestamp in a list of children. One date
 * subtraction turns it into the fact anyone actually wanted, and it is the same
 * device that carries FamilyAlbum's entire emotional payload for 18 million
 * parents.
 */
function ageLine(dob: string | null): string | null {
  if (!dob) return null;

  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 +
    (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;

  const years = Math.floor(months / 12);
  const rest = months % 12;

  if (years === 0) return `${rest}m`;
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
}

function parentsLine(count: number): string {
  if (count === 0) return 'No parent linked';
  return count === 1 ? '1 parent' : `${count} parents`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StudentCard>` — one child in a class.
 *
 * The row leads with the child: their photograph where the school holds one,
 * and otherwise their initials on the wash their name always gets. It used to
 * draw a grey person glyph in a grey circle for every child alike, ignoring
 * `avatar_url` entirely — twenty-five identical grey heads, which is both less
 * useful and colder than a name rendered as a mark.
 *
 * Underneath, the two facts an administrator is actually checking: how old the
 * child is, and whether anyone can see their photographs yet.
 */
export function StudentCard({ student, onPress, onRemove }: StudentCardProps) {
  const age = ageLine(student.date_of_birth);
  const parents = parentsLine(student.parent_count);
  const meta = age ? `${age} · ${parents}` : parents;

  return (
    <Pressable
      onPress={() => onPress(student.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${student.full_name}, ${meta}`}
      accessibilityHint="Opens the parents linked to this child"
    >
      <Avatar uri={student.avatar_url} name={student.full_name} size="md" />

      <View style={styles.info}>
        <Text variant="bodyBold" numberOfLines={1}>
          {student.full_name}
        </Text>
        <Text
          variant="bodySmall"
          color={
            student.parent_count === 0 ? colors.warning.main : colors.text.secondary
          }
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>

      <Pressable
        onPress={() => onRemove(student.id)}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${student.full_name} from this class`}
      >
        <Ionicons name="close" size={20} color={colors.text.tertiary} />
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
    gap: spacing.ms,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.ms,
    paddingRight: spacing.xs,
    minHeight: MIN_TAP_SIZE + spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.light,
  },
  cardPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  info: {
    flex: 1,
    gap: spacing.xxs,
  },
  remove: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  removePressed: {
    backgroundColor: colors.gray[100],
  },
});

export default StudentCard;
