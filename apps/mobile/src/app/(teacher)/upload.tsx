import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useQueryClient } from '@tanstack/react-query';

import { colors, spacing, radius, layout, MAX_UPLOAD_IMAGES } from '@/theme';
import { Text, Button, SectionHeader } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { ClassSelector, type ClassItem } from '@/components/forms/ClassSelector';
import { StudentTagger } from '@/components/forms/StudentTagger';

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
 * On completion: a checkmark, a count of what was shared, and "Share more".
 * Deliberately quiet — a teacher runs this flow every working day, and an
 * effect that fires that often stops being a reward and becomes a delay.
 */
export default function UploadScreen() {
  const queryClient = useQueryClient();

  // ── Classes ─────────────────────────────────────────────────────────
  const { classes, defaultClassId } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const handleClassSelect = useCallback((cls: ClassItem) => {
    setSelectedClassId(cls.id);
    // Reset students when class changes
    setSelectedStudentIds([]);
    setStudents([]);
  }, []);

  // Preselect the teacher's own class rather than leaving the picker empty or
  // landing on whichever class sorts first at the school — see
  // `useClasses().defaultClassId`. Every class stays pickable; this only sets
  // the starting point.
  useEffect(() => {
    if (defaultClassId && !selectedClassId) {
      setSelectedClassId(defaultClassId);
    }
  }, [defaultClassId, selectedClassId]);

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
      // Ask iOS for a compatible representation, which transcodes HEIC to JPEG
      // on the device. Without it the picker hands back the original HEIC, and
      // the server rejects it: sharp's prebuilt libvips ships libheif without
      // an HEVC decoder, so an iPhone photo — the default format on iOS —
      // fails with "No decoding plugin installed for this compression format".
      // Proven against a real HEVC HEIC on 24 July 2026. iOS 14+; ignored
      // elsewhere.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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
    resetUpload();
    setSelectedStudentIds([]);
  }, [resetUpload]);

  // ── Computed state ──────────────────────────────────────────────────
  const hasImages = images.length > 0;
  // Photos still to send — idle ones and any that failed and will be retried.
  const pendingCount = images.filter(
    (img) => img.state === 'idle' || img.state === 'error',
  ).length;
  // At least one tagged student is required, not optional: the parent feed is
  // built by joining photo_student_tags, and nothing in the app can tag a
  // photo once it has been uploaded.
  const canUpload =
    hasImages &&
    !!selectedClassId &&
    selectedStudentIds.length > 0 &&
    !isUploading &&
    !isComplete;

  return (
    <ScreenContainer scroll keyboard edges={['top', 'left', 'right']}>
      <HeaderBar large title="Share photos" />

      <View style={styles.content}>
        {/* Step 1: Pick Images.
            The numbering is real here — this is a sequence a teacher works
            through in order between activities, not decoration. */}
        <View style={styles.section}>
          <SectionHeader eyebrow="Step 1" title="Choose photos" style={styles.stepHeader} />
          <Button
            variant={hasImages ? 'outline' : 'primary'}
            fullWidth
            onPress={handlePickImages}
            disabled={isUploading}
            leftIcon={
              <Ionicons
                name="images-outline"
                size={20}
                color={hasImages ? colors.text.primary : colors.ink[900]}
              />
            }
          >
            {hasImages
              ? `Add more · ${images.length} of ${MAX_UPLOAD_IMAGES}`
              : 'Choose from library'}
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
            <SectionHeader
              eyebrow="Step 2"
              title="Who is in them?"
              style={styles.stepHeader}
            />

            <ClassSelector
              classes={classes}
              selectedId={selectedClassId}
              onSelect={handleClassSelect}
              label="Class"
              placeholder="Select a class"
              style={styles.classSelector}
            />

            {selectedClassId && (
              <Button
                variant="outline"
                fullWidth
                onPress={() => setShowTagger(true)}
                disabled={studentsLoading}
                loading={studentsLoading}
                leftIcon={
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={colors.text.primary}
                  />
                }
              >
                {selectedStudentIds.length > 0
                  ? `${selectedStudentIds.length} child${selectedStudentIds.length !== 1 ? 'ren' : ''} tagged`
                  : 'Tag children'}
              </Button>
            )}

            {/* The feed joins photo_student_tags, so an untagged photo reaches
                nobody — and there is no way to tag it after upload. It was
                labelled "Optional", which made silently invisible photos the
                easiest outcome to produce. */}
            {selectedClassId && selectedStudentIds.length === 0 && (
              <View style={styles.tagHint}>
                <Ionicons name="information-circle" size={17} color={colors.text.accent} />
                <Text variant="bodySmall" color={colors.text.accent} style={styles.tagHintText}>
                  Tag at least one child. A photo is only shown to the families of
                  the children tagged in it.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Step 4: Upload Button.
            Rendered whenever there is something to upload and disabled with a
            reason, rather than disappearing — a control that vanishes when its
            preconditions are unmet leaves the teacher with nothing to read. */}
        {hasImages && !isUploading && !isComplete && (
          <View style={styles.section}>
            <SectionHeader eyebrow="Step 3" title="Send them" style={styles.stepHeader} />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleStartUpload}
              disabled={!canUpload}
              leftIcon={
                <Ionicons name="cloud-upload" size={20} color={colors.ink[900]} />
              }
            >
              {`Share ${pendingCount} photo${pendingCount !== 1 ? 's' : ''}`}
            </Button>
          </View>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text variant="bodyBold">Sending…</Text>
              <Text variant="price">{Math.round(overallProgress * 100)}%</Text>
            </View>
            <View style={styles.overallProgressTrack}>
              <MotiView
                animate={{ width: `${Math.round(overallProgress * 100)}%` }}
                transition={{ type: 'timing', duration: 220 }}
                style={styles.overallProgressFill}
              />
            </View>
            <Text variant="caption" muted style={styles.progressHint}>
              Keep this screen open until it finishes.
            </Text>
          </View>
        )}

        {/* Complete state */}
        {isComplete && (
          <View style={styles.completeSection}>
            <MotiView
              from={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              style={styles.completeMark}
            >
              <Ionicons name="checkmark" size={34} color={colors.success.dark} />
            </MotiView>
            <Text variant="h2" center style={styles.completeTitle}>
              Shared
            </Text>
            <Text variant="body" muted center style={styles.completeMessage}>
              {images.length} photo{images.length !== 1 ? 's are' : ' is'} now in the
              feed of every family you tagged.
            </Text>
            <Button
              variant="primary"
              fullWidth
              onPress={handleUploadMore}
              leftIcon={<Ionicons name="add" size={20} color={colors.ink[900]} />}
            >
              Share more
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
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: layout.tabBarClearance,
  },
  section: {
    marginBottom: spacing.xl,
  },
  stepHeader: {
    marginBottom: spacing.md,
  },
  classSelector: {
    marginBottom: spacing.ms,
  },
  tagHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.ms,
    padding: spacing.ms,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.amberWash,
  },
  tagHintText: {
    flex: 1,
  },
  progressSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallProgressTrack: {
    height: 8,
    backgroundColor: colors.background.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.ms,
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.amber,
    borderRadius: 4,
  },
  progressHint: {
    marginTop: spacing.sm,
  },
  completeSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  completeMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  completeTitle: {
    marginBottom: spacing.sm,
  },
  completeMessage: {
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
});
