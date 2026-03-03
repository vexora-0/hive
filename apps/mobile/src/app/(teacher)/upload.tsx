import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { colors, spacing, MAX_UPLOAD_IMAGES } from '@/theme';
import { Text, Button } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { ClassSelector, type ClassItem } from '@/components/forms/ClassSelector';
import { StudentTagger } from '@/components/forms/StudentTagger';
import { ConfettiOverlay } from '@/components/animation';

import { useClasses } from '@/features/teacher/hooks/useClasses';
import { useUpload, type PickedAsset } from '@/features/teacher/hooks/useUpload';
import { getClassStudents } from '@/features/teacher/services/teacherService';
import { UploadPreview } from '@/features/teacher/components/UploadPreview';
import type { StudentItem } from '@/components/forms/StudentTagger';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher Upload screen.
 *
 * Four-step flow:
 * 1. Pick images (expo-image-picker, multi-select, max 20)
 * 2. Preview selected images in a horizontal scroll (UploadPreview)
 * 3. Select class and tag students (ClassSelector + StudentTagger)
 * 4. Upload -- starts the upload pipeline with progress display
 *
 * On completion: confetti overlay + "Upload More" button.
 */
export default function UploadScreen() {
  const queryClient = useQueryClient();

  // ── Classes ─────────────────────────────────────────────────────────
  const { classes } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const handleClassSelect = useCallback((cls: ClassItem) => {
    setSelectedClassId(cls.id);
    // Reset students when class changes
    setSelectedStudentIds([]);
    setStudents([]);
  }, []);

  // ── Students ────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showTagger, setShowTagger] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Fetch students when a class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    let cancelled = false;
    setStudentsLoading(true);

    getClassStudents(selectedClassId)
      .then((result) => {
        if (!cancelled) {
          setStudents(result);
          setStudentsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  // ── Upload hook ─────────────────────────────────────────────────────
  const {
    images,
    addImages,
    removeImage,
    startUpload,
    retryImage,
    overallProgress,
    isUploading,
    isComplete,
    showConfetti,
    dismissConfetti,
    resetUpload,
  } = useUpload();

  // ── Image Picker ────────────────────────────────────────────────────
  const handlePickImages = useCallback(async () => {
    const remaining = MAX_UPLOAD_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert(
        'Limit Reached',
        `You can upload a maximum of ${MAX_UPLOAD_IMAGES} images at a time.`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || result.assets.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const assets: PickedAsset[] = result.assets.map((a) => ({
      uri: a.uri,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
    }));

    addImages(assets);
  }, [images.length, addImages]);

  // ── Start Upload ────────────────────────────────────────────────────
  const handleStartUpload = useCallback(async () => {
    if (!selectedClassId) {
      Alert.alert('Select a Class', 'Please select a class before uploading.');
      return;
    }

    if (images.length === 0) {
      Alert.alert('No Photos', 'Please select at least one photo to upload.');
      return;
    }

    await startUpload(selectedClassId, selectedStudentIds);

    // Invalidate photos query so dashboard refreshes
    queryClient.invalidateQueries({ queryKey: ['teacher-photos'] });
  }, [selectedClassId, images.length, selectedStudentIds, startUpload, queryClient]);

  // ── Retry ───────────────────────────────────────────────────────────
  const handleRetryImage = useCallback(
    (id: string) => {
      if (!selectedClassId) return;
      retryImage(id, selectedClassId, selectedStudentIds);
    },
    [selectedClassId, selectedStudentIds, retryImage],
  );

  // ── Upload More ─────────────────────────────────────────────────────
  const handleUploadMore = useCallback(() => {
    dismissConfetti();
    resetUpload();
    setSelectedStudentIds([]);
  }, [dismissConfetti, resetUpload]);

  // ── Computed state ──────────────────────────────────────────────────
  const hasImages = images.length > 0;
  const canUpload = hasImages && !!selectedClassId && !isUploading && !isComplete;

  return (
    <ScreenContainer scroll keyboard edges={['top', 'left', 'right']}>
      <HeaderBar title="Upload Photos" />

      <View style={styles.content}>
        {/* Step 1: Pick Images */}
        <View style={styles.section}>
          <Text variant="h4" style={styles.stepLabel}>
            1. Select Photos
          </Text>
          <Button
            variant={hasImages ? 'outline' : 'primary'}
            onPress={handlePickImages}
            disabled={isUploading}
            leftIcon={
              <Ionicons
                name="images-outline"
                size={20}
                color={hasImages ? colors.primary.amber : colors.white}
              />
            }
          >
            {hasImages
              ? `Add More (${images.length}/${MAX_UPLOAD_IMAGES})`
              : 'Choose Photos'}
          </Button>
        </View>

        {/* Step 2: Preview */}
        {hasImages && (
          <UploadPreview
            images={images}
            onRemove={removeImage}
            onRetry={handleRetryImage}
          />
        )}

        {/* Step 3: Class & Student Selection */}
        {hasImages && !isComplete && (
          <View style={styles.section}>
            <Text variant="h4" style={styles.stepLabel}>
              2. Class & Students
            </Text>

            <ClassSelector
              classes={classes}
              selectedId={selectedClassId}
              onSelect={handleClassSelect}
              label="Assign to Class"
              placeholder="Select a class"
              style={styles.classSelector}
            />

            {selectedClassId && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setShowTagger(true)}
                disabled={studentsLoading}
                loading={studentsLoading}
                leftIcon={
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={colors.primary.amber}
                  />
                }
                style={styles.tagButton}
              >
                {selectedStudentIds.length > 0
                  ? `${selectedStudentIds.length} Student${selectedStudentIds.length !== 1 ? 's' : ''} Tagged`
                  : 'Tag Students (Optional)'}
              </Button>
            )}
          </View>
        )}

        {/* Step 4: Upload Button */}
        {canUpload && (
          <View style={styles.section}>
            <Text variant="h4" style={styles.stepLabel}>
              3. Upload
            </Text>
            <Button
              variant="primary"
              size="lg"
              onPress={handleStartUpload}
              leftIcon={
                <Ionicons name="cloud-upload-outline" size={22} color={colors.white} />
              }
            >
              {`Upload ${images.length} Photo${images.length !== 1 ? 's' : ''}`}
            </Button>
          </View>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <View style={styles.progressSection}>
            <Text variant="bodyBold" color={colors.text.primary}>
              Uploading... {Math.round(overallProgress * 100)}%
            </Text>
            <View style={styles.overallProgressTrack}>
              <View
                style={[
                  styles.overallProgressFill,
                  { width: `${Math.round(overallProgress * 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Complete state */}
        {isComplete && (
          <View style={styles.completeSection}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={colors.success.main}
            />
            <Text variant="h3" style={styles.completeTitle}>
              All Photos Uploaded!
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              center
              style={styles.completeMessage}
            >
              {images.length} photo{images.length !== 1 ? 's' : ''} uploaded
              successfully.
            </Text>
            <Button
              variant="primary"
              onPress={handleUploadMore}
              leftIcon={
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
              }
              style={styles.uploadMoreButton}
            >
              Upload More
            </Button>
          </View>
        )}
      </View>

      {/* Student Tagger Bottom Sheet */}
      <StudentTagger
        students={students}
        selectedIds={selectedStudentIds}
        onSelectionChange={setSelectedStudentIds}
        isVisible={showTagger}
        onClose={() => setShowTagger(false)}
      />

      {/* Confetti overlay */}
      <ConfettiOverlay trigger={showConfetti} />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  stepLabel: {
    marginBottom: spacing.sm,
  },
  classSelector: {
    marginBottom: spacing.sm,
  },
  tagButton: {
    alignSelf: 'flex-start',
  },
  progressSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background.surfaceSecondary,
    borderRadius: 12,
  },
  overallProgressTrack: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.amber,
    borderRadius: 4,
  },
  completeSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  completeTitle: {
    marginTop: spacing.md,
  },
  completeMessage: {
    marginTop: spacing.sm,
  },
  uploadMoreButton: {
    marginTop: spacing.lg,
  },
});
