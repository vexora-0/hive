import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui';
import { BottomSheet } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassItem {
  id: string;
  name: string;
  /** Nullable — classes.grade is optional in the schema. */
  grade: string | null;
  /**
   * Profile id of the class's own teacher, when known. Not rendered; callers
   * use it to decide which class to preselect. Nullable in the schema.
   */
  teacherId?: string | null;
}

export interface ClassSelectorProps {
  /** Available classes to pick from. */
  classes: ClassItem[];
  /** Currently selected class id (controlled). */
  selectedId?: string | null;
  /** Called when a class is selected. */
  onSelect: (classItem: ClassItem) => void;
  /** Label shown above the selector button. */
  label?: string;
  /** Placeholder text when nothing is selected. */
  placeholder?: string;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How tall the list of classes may grow.
 *
 * The sheet's own ceiling is a fraction of the window, but a `FlatList` with no
 * bound of its own does not shrink to fit it — RN's default `flexShrink` is 0,
 * so an unbounded list inside a clamped parent overflows and clips instead of
 * scrolling. The bound therefore goes on the list itself. Half the window on a
 * small phone, 360 on anything larger, which is seven or eight classes visible
 * at once — past that a teacher is scrolling either way.
 */
const LIST_MAX_HEIGHT = 360;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ClassSelector>` — a disclosure control that opens the class list in a sheet.
 *
 * The trigger is a recessed well rather than an outlined box, so it matches
 * `<TextInput>`: at rest it is a sunk paper tone, and pressing raises it. A
 * form of three quiet wells reads better than a grid of empty rectangles.
 *
 * The sheet is `@/components/feedback/BottomSheet` — this component used to
 * hand-roll its own backdrop, 65%-tall panel and 40×4 handle, one of fourteen
 * such copies in the app, each with a different height ceiling and two
 * different grounds between them.
 *
 * ```tsx
 * <ClassSelector
 *   classes={classes}
 *   selectedId={selectedClassId}
 *   onSelect={(cls) => setSelectedClassId(cls.id)}
 *   label="Class"
 *   placeholder="Select a class"
 * />
 * ```
 */
export function ClassSelector({
  classes,
  selectedId,
  onSelect,
  label,
  placeholder = 'Select a class',
  style,
}: ClassSelectorProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedId) ?? null,
    [classes, selectedId],
  );

  const handleOpen = useCallback(() => setSheetVisible(true), []);
  const handleClose = useCallback(() => setSheetVisible(false), []);

  const handleSelect = useCallback(
    (item: ClassItem) => {
      onSelect(item);
      setSheetVisible(false);
    },
    [onSelect],
  );

  // ── List item renderer ───────────────────────────────────────────────
  //
  // Rows run the full width of the sheet and carry their own padding, so the
  // selected band is a full-width wash rather than a floating pill. Their text
  // starts on the same margin as the sheet's title.
  const renderItem = useCallback(
    ({ item }: { item: ClassItem }) => {
      const isSelected = item.id === selectedId;

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [
            styles.listItem,
            isSelected && styles.listItemSelected,
            pressed && styles.listItemPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={
            item.grade ? `${item.name}, ${item.grade}` : item.name
          }
        >
          <View style={styles.listItemContent}>
            <Text
              variant={isSelected ? 'bodyBold' : 'body'}
              color={isSelected ? colors.text.accent : colors.text.primary}
            >
              {item.name}
            </Text>
            {item.grade && (
              <Text variant="bodySmall" color={colors.text.secondary}>
                {item.grade}
              </Text>
            )}
          </View>

          {isSelected && (
            <Ionicons
              name="checkmark"
              size={20}
              color={colors.text.accent}
              style={styles.checkmark}
            />
          )}
        </Pressable>
      );
    },
    [selectedId, handleSelect],
  );

  const keyExtractor = useCallback((item: ClassItem) => item.id, []);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text variant="label" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: sheetVisible }}
        accessibilityLabel={
          selectedClass
            ? `${label ? `${label}: ` : ''}${selectedClass.name}${
                selectedClass.grade ? `, ${selectedClass.grade}` : ''
              }. Tap to change.`
            : placeholder
        }
      >
        {selectedClass ? (
          <View style={styles.triggerContent}>
            <Text variant="bodyMedium" color={colors.text.primary} numberOfLines={1}>
              {selectedClass.name}
            </Text>
            {selectedClass.grade && (
              <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                {selectedClass.grade}
              </Text>
            )}
          </View>
        ) : (
          <Text variant="body" color={colors.text.tertiary} style={styles.triggerContent}>
            {placeholder}
          </Text>
        )}

        {/* One icon hand: the chevron is Ionicons like every other glyph in the
            app. It used to be a literal down-arrow character set as text, which
            sat on a different baseline and at a different weight from every icon
            beside it. */}
        <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
      </Pressable>

      <BottomSheet
        visible={sheetVisible}
        onClose={handleClose}
        title="Select a class"
        contentStyle={styles.sheetBody}
      >
        {classes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="body" muted center>
              No classes yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={classes}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={{ maxHeight: Math.min(LIST_MAX_HEIGHT, windowHeight * 0.5) }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BottomSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    // Matches the height of `<TextInput>`'s field so a label, a well and a
    // selector stack into one column without an optical step.
    minHeight: 52,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerPressed: {
    backgroundColor: colors.background.surface,
  },
  triggerContent: {
    flex: 1,
  },
  /** The rows own their horizontal padding, so the body gives up its own. */
  sheetBody: {
    paddingHorizontal: 0,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.ms,
  },
  listItemSelected: {
    backgroundColor: colors.primary.amberWash,
  },
  listItemPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  listItemContent: {
    flex: 1,
  },
  checkmark: {
    marginLeft: 'auto',
  },
});

export default ClassSelector;
