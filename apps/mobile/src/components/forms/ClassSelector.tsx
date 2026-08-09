import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, spacing, layout, fontFamily, fontSize, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui';
import { Modal } from '@/components/feedback';

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
// Component
// ---------------------------------------------------------------------------

/**
 * `<ClassSelector>` -- dropdown-style picker backed by a bottom sheet.
 *
 * Shows the selected class name (with grade context) in a pressable trigger.
 * Tapping opens a `@gorhom/bottom-sheet` list of all available classes.
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
        >
          <View style={styles.listItemContent}>
            <Text
              variant="body"
              color={isSelected ? colors.primary.amberDark : colors.text.primary}
              style={isSelected ? { fontFamily: fontFamily.bodySemiBold } : undefined}
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
            <View style={styles.checkmark}>
              <Text variant="body" color={colors.primary.amber}>
                {'✓'}
              </Text>
            </View>
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
      {/* Label */}
      {label && (
        <Text variant="bodySmallBold" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}

      {/* Trigger button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          selectedClass
            ? `Selected class: ${selectedClass.name}${
                selectedClass.grade ? `, ${selectedClass.grade}` : ''
              }. Tap to change.`
            : placeholder
        }
      >
        {selectedClass ? (
          <View style={styles.triggerContent}>
            <Text variant="body" color={colors.text.primary} numberOfLines={1}>
              {selectedClass.name}
            </Text>
            {selectedClass.grade && (
              <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                {selectedClass.grade}
              </Text>
            )}
          </View>
        ) : (
          <Text variant="body" color={colors.text.tertiary}>
            {placeholder}
          </Text>
        )}

        {/* Chevron */}
        <Text variant="body" color={colors.text.tertiary} style={styles.chevron}>
          {'▾'}
        </Text>
      </Pressable>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={handleClose}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handleBar} />
              <View style={styles.sheetHeader}>
                <Text variant="h4" color={colors.text.primary}>
                  Select Class
                </Text>
              </View>

              {classes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="body" color={colors.text.secondary} center>
                    No classes available
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={classes}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_SIZE,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerPressed: {
    backgroundColor: colors.gray[50],
  },
  triggerContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chevron: {
    marginLeft: 'auto',
  },
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '65%',
    minHeight: 200,
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
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
  sheetHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: layout.buttonRadius,
    marginTop: spacing.xs,
  },
  listItemSelected: {
    backgroundColor: colors.warning.background,
  },
  listItemPressed: {
    backgroundColor: colors.gray[100],
  },
  listItemContent: {
    flex: 1,
  },
  checkmark: {
    marginLeft: spacing.sm,
  },
});

export default ClassSelector;
