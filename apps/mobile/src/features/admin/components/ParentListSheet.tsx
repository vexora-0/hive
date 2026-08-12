import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { useStudentParents } from '@/features/admin/hooks/useClassDetail';
import { ConfirmDialog, Modal } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentListSheetProps {
  isVisible: boolean;
  studentId: string | null;
  studentName: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ParentListSheet({
  isVisible,
  studentId,
  studentName,
  onClose,
}: ParentListSheetProps) {
  const {
    parents,
    allParents,
    isLoading,
    isLoadingAllParents,
    mapParent,
    isMappingParent,
    removeParent,
    isRemovingParent,
  } = useStudentParents(isVisible ? studentId : null);

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  /** Parent awaiting unlink confirmation. Null when no dialog is open. */
  const [parentToRemove, setParentToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!isVisible) {
      setShowPicker(false);
      setSearch('');
      setParentToRemove(null);
    }
  }, [isVisible]);

  // Filter out already-mapped parents and apply search
  const availableParents = useMemo(() => {
    const mappedIds = new Set(parents.map((p) => p.parent_id));
    let filtered = allParents.filter((p) => !mappedIds.has(p.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [allParents, parents, search]);

  const handleSelectParent = useCallback(
    async (email: string) => {
      try {
        await mapParent(email);
        setShowPicker(false);
        setSearch('');
      } catch {
        // error handled by hook
      }
    },
    [mapParent],
  );

  // Unlinking cuts a parent's access to this child's photos, so it asks first.
  const handleRemoveParent = useCallback((parentId: string, name: string) => {
    setParentToRemove({ id: parentId, name });
  }, []);

  const confirmRemoveParent = useCallback(() => {
    if (parentToRemove) {
      // Not awaited — the dialog closes immediately. The catch is required:
      // removeParent returns mutateAsync, which rejects on failure, and the
      // toast has already reported it.
      removeParent(parentToRemove.id).catch(() => {});
    }
    setParentToRemove(null);
  }, [parentToRemove, removeParent]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleBar} />
          <View style={styles.content}>
            {showPicker ? (
              /* ── Parent Picker ────────────────────────────────── */
              <>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={() => { setShowPicker(false); setSearch(''); }} hitSlop={8}>
                    <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
                  </Pressable>
                  <Text variant="h3" style={styles.pickerTitle}>
                    Select Parent
                  </Text>
                </View>

                <TextInput
                  placeholder="Search by name or email..."
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  containerStyle={styles.searchField}
                />

                <ScrollView
                  style={styles.pickerList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {isLoadingAllParents && (
                    <ActivityIndicator
                      size="small"
                      color={colors.text.accent}
                      style={styles.loader}
                    />
                  )}

                  {!isLoadingAllParents && availableParents.length === 0 && (
                    <Text variant="body" color={colors.text.secondary} center style={styles.empty}>
                      {search.trim() ? 'No matching parents found' : 'No available parents'}
                    </Text>
                  )}

                  {availableParents.map((parent) => (
                    <Pressable
                      key={parent.id}
                      style={({ pressed }) => [
                        styles.parentOption,
                        pressed && styles.parentOptionPressed,
                      ]}
                      onPress={() => handleSelectParent(parent.email)}
                      disabled={isMappingParent}
                    >
                      <Ionicons name="person-outline" size={20} color={colors.text.primary} />
                      <View style={styles.parentInfo}>
                        <Text variant="body">{parent.full_name}</Text>
                        <Text variant="bodySmall" color={colors.text.secondary}>
                          {parent.email}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color={colors.text.accent} />
                    </Pressable>
                  ))}
                </ScrollView>

                {isMappingParent && (
                  <View style={styles.mappingOverlay}>
                    <ActivityIndicator size="small" color={colors.text.accent} />
                    <Text variant="bodySmall" color={colors.text.secondary} style={styles.mappingText}>
                      Mapping parent...
                    </Text>
                  </View>
                )}
              </>
            ) : (
              /* ── Mapped Parents List ──────────────────────────── */
              <>
                <Text variant="h3" style={styles.title}>
                  Parents
                </Text>
                <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
                  for {studentName}
                </Text>

                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                  {isLoading && (
                    <Text variant="body" color={colors.text.secondary} center style={styles.empty}>
                      Loading...
                    </Text>
                  )}

                  {!isLoading && parents.length === 0 && (
                    <Text variant="body" color={colors.text.secondary} center style={styles.empty}>
                      No parents mapped yet
                    </Text>
                  )}

                  {parents.map((parent) => (
                    <View key={parent.id} style={styles.parentRow}>
                      <Ionicons name="person-outline" size={20} color={colors.text.primary} />
                      <View style={styles.parentInfo}>
                        <Text variant="body">{parent.full_name}</Text>
                        <Text variant="bodySmall" color={colors.text.secondary}>
                          {parent.email} · {parent.relationship}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          handleRemoveParent(parent.parent_id, parent.full_name)
                        }
                        hitSlop={8}
                        disabled={isRemovingParent}
                        accessibilityRole="button"
                        accessibilityLabel={`Unlink ${parent.full_name} from ${studentName}`}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error.main} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>

                <Button
                  variant="primary"
                  size="md"
                  onPress={() => setShowPicker(true)}
                  style={styles.addButton}
                >
                  Map Parent
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onPress={onClose}
                  style={styles.closeButton}
                >
                  Close
                </Button>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>

      {/* Nested inside the sheet's Modal, not a sibling of it. On iOS
          RCTModalHostViewComponentView presents from `reactViewController`,
          which walks the responder chain to the *nearest* UIViewController —
          there is no topmost-VC logic. A sibling therefore presents from the
          root VC, which is already presenting this sheet, and UIKit refuses
          with "already presenting". Nested, the nearest VC is this sheet's own
          RCTFabricModalHostViewController, which is presenting nothing. */}
      <ConfirmDialog
        visible={!!parentToRemove}
        title="Unlink parent"
        message={`Unlink ${parentToRemove?.name ?? 'this parent'} from ${studentName}? They will stop seeing this child's photos.`}
        confirmLabel="Unlink"
        destructive
        onConfirm={confirmRemoveParent}
        onCancel={() => setParentToRemove(null)}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 250,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  parentInfo: {
    flex: 1,
  },
  addButton: {
    marginTop: spacing.md,
  },
  closeButton: {
    marginTop: spacing.sm,
  },
  // Picker styles
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerTitle: {
    flex: 1,
  },
  searchField: {
    marginBottom: spacing.sm,
  },
  pickerList: {
    maxHeight: 300,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  parentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  parentOptionPressed: {
    backgroundColor: colors.primary.amberLight + '15',
  },
  mappingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  mappingText: {
    marginLeft: spacing.xs,
  },
});
