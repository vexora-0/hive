import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { colors, spacing, radius, layout, MAX_UPLOAD_IMAGES } from '@/theme';
import { Text, Button, Chip } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { Reveal } from '@/components/animation';
import { Bo } from '@/components/mascot';
import { StackOfPrints } from '@/components/illustration';
import { SkeletonShimmer, useToast } from '@/components/feedback';
import { ClassSelector, type ClassItem } from '@/components/forms/ClassSelector';

import { useClasses } from '@/features/teacher/hooks/useClasses';
import { useUpload, type PickedAsset } from '@/features/teacher/hooks/useUpload';
import { getClassStudents } from '@/features/teacher/services/teacherService';
import { UploadPreview } from '@/features/teacher/components/UploadPreview';
import type { StudentItem } from '@/components/forms/StudentTagger';

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * First names on the rail, because a rail of "Aarav Sharma" fits four chips on
 * a phone and a rail of "Aarav" fits nine — and the teacher already knows which
 * Aarav they mean. An initial is appended **only** where two children in the
 * same class share a first name, which is the one case where the short form
 * stops being an answer.
 */
function railNames(students: StudentItem[]): Record<string, string> {
  const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

  const counts = new Map<string, number>();
  for (const student of students) {
    const first = firstOf(student.name);
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }

  const result: Record<string, string> = {};
  for (const student of students) {
    const parts = student.name.trim().split(/\s+/);
    const first = parts[0] ?? student.name;
    const surnameInitial = parts.length > 1 ? parts[parts.length - 1][0] : '';
    result[student.id] =
      (counts.get(first) ?? 0) > 1 && surnameInitial
        ? `${first} ${surnameInitial}`
        : first;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher upload — the tool the whole product depends on.
 *
 * ## The rail
 *
 * The screen is built around one move: **a docked rail of children's names
 * along the bottom, while the photographs page above it.** The teacher swipes
 * through what they shot with a thumb and taps names with a finger, and no
 * sheet opens or closes at any point. The model it replaces — open a panel,
 * find the child, tick, close, next photo — costs about six taps per
 * photograph, which is tolerable for one face and untenable for forty photos
 * across twenty-five children.
 *
 * Each chip carries a running count, so coverage is legible along the rail
 * instead of needing an audit at the end: a teacher glancing down sees "Aarav
 * 7 · Meera 6 · Diya 0" and knows exactly who is missing from this week.
 *
 * ## What the counts actually count
 *
 * The counts are a **session ledger**, not a per-photo tally, and that is a
 * limit of the data rather than a design choice. `useUpload.startUpload` takes
 * one class and one set of students and applies them to every photograph in the
 * batch; there is no per-image tag parameter, and adding one would change the
 * hook's interface, which is frozen for this pass. So a chip shows how many
 * photographs that child has been tagged in *this session* — the batches
 * already sent, plus the batch being composed if their chip is lit. That is a
 * true number and it answers the question the rail exists to answer. It is not
 * "who is in this particular photograph", which the pipeline cannot express.
 *
 * ## Once sending starts, the rail freezes
 *
 * `retryImage` re-sends a failed photograph with whatever selection is current.
 * If the teacher could edit chips between a failure and a retry, the retried
 * photograph would land with different tags from the twelve beside it and
 * nothing in the app can retag a photograph after upload. So the selection is
 * captured when Share is pressed and held until the batch is cleared; the rail
 * becomes a read-only record of what this batch was tagged with.
 *
 * ## Progress
 *
 * Per file, never aggregate — see `UploadProgress`. Finishing is near-silent: a
 * checkmark and **one** Success haptic for the batch.
 */
export default function UploadScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  /**
   * How far the dock has to hold off the bottom edge.
   *
   * `layout.tabBarClearance` is the figure a *scrolling list* uses, and it is
   * two points short of the real footprint on a phone with a home indicator —
   * harmless when the shortfall lands on the last row of a list you can scroll,
   * and not harmless at all under a pinned primary button. Composed from the
   * bar's own parts instead: its height, whatever the safe area asks for, and
   * one gap above it.
   */
  const dockInset =
    layout.tabBarHeight + Math.max(insets.bottom, spacing.ms) + spacing.md;

  // ── Classes ─────────────────────────────────────────────────────────
  const { classes, defaultClassId } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

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
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState(false);
  const [studentsAttempt, setStudentsAttempt] = useState(0);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  /**
   * Photographs each child has been tagged in earlier **in this session**. Only
   * completed uploads are folded in — a photograph that failed and was
   * abandoned reached nobody, and counting it would overstate coverage in the
   * one place a teacher relies on it.
   */
  const [tagLedger, setTagLedger] = useState<Record<string, number>>({});
  /** The selection this batch went out with. Non-null from Share until reset. */
  const [lockedStudentIds, setLockedStudentIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    let cancelled = false;
    setStudentsLoading(true);
    setStudentsError(false);

    getClassStudents(selectedClassId)
      .then((result) => {
        if (cancelled) return;
        setStudents(result);
        setStudentsLoading(false);
      })
      .catch(() => {
        // This used to fail silently, which left the rail empty and reading as
        // "this class has no children" — a sentence that sends a teacher to the
        // office rather than to the retry button.
        if (cancelled) return;
        setStudents([]);
        setStudentsError(true);
        setStudentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassId, studentsAttempt]);

  const handleClassSelect = useCallback((cls: ClassItem) => {
    setSelectedClassId(cls.id);
    // A different class is a different set of children, so nothing about the
    // old one survives — neither the selection nor the coverage counts.
    setSelectedStudentIds([]);
    setStudents([]);
    setTagLedger({});
  }, []);

  const handleRetryStudents = useCallback(() => {
    setStudentsAttempt((n) => n + 1);
  }, []);

  // ── Upload hook ─────────────────────────────────────────────────────
  const {
    images,
    addImages,
    removeImage,
    startUpload,
    retryImage,
    isUploading,
    isComplete,
    resetUpload,
  } = useUpload();

  // ── Image picker ────────────────────────────────────────────────────
  const handlePickImages = useCallback(async () => {
    const remaining = MAX_UPLOAD_IMAGES - images.length;
    if (remaining <= 0) {
      toast.info(
        `${MAX_UPLOAD_IMAGES} photos is one batch. Send these, then start another.`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // `MediaTypeOptions.Images` is deprecated in SDK 54 and routes through
      // `mapDeprecatedOptions`, which is the `parseMediaTypes` warning that
      // opens the console every time the picker is used. The array form is the
      // current API and behaves identically.
      mediaTypes: ['images'],
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

    // At the moment the photographs land, not at the moment they were asked
    // for — the haptic marks the result, never the request.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const assets: PickedAsset[] = result.assets.map((a) => ({
      uri: a.uri,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
    }));

    const added = addImages(assets);
    if (added < assets.length) {
      toast.info(
        `Added ${added}. A batch holds ${MAX_UPLOAD_IMAGES} photos, and this one is full.`,
      );
    }
  }, [images.length, addImages, toast]);

  // ── Tagging ─────────────────────────────────────────────────────────
  const nameFor = useMemo(() => railNames(students), [students]);

  const toggleStudent = useCallback((id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const completedCount = useMemo(
    () => images.filter((img) => img.state === 'complete').length,
    [images],
  );

  /**
   * What a chip shows: everything this child has already been tagged in during
   * this session, plus this batch if their chip is lit. While a batch is in
   * flight only the photographs that have actually landed are added, so the
   * number climbs with the upload rather than promising it.
   */
  const countFor = useCallback(
    (id: string) => {
      const banked = tagLedger[id] ?? 0;
      const active = lockedStudentIds ?? selectedStudentIds;
      if (!active.includes(id)) return banked;
      return banked + (lockedStudentIds ? completedCount : images.length);
    },
    [tagLedger, lockedStudentIds, selectedStudentIds, completedCount, images.length],
  );

  // ── Start upload ────────────────────────────────────────────────────
  const handleStartUpload = useCallback(async () => {
    // The button is disabled without these, so none of these branches should
    // be reachable. They are kept because the alternative — returning in
    // silence — is what made a dead Share button look like a broken one. All
    // three used to be native system alert dialogs, which arrive in the
    // platform's typeface on the platform's grey card and stop the app dead;
    // the toast is the app speaking in its own voice, over the screen the
    // teacher is still working on.
    if (!selectedClassId) {
      toast.error('Choose a class first.');
      return;
    }
    if (images.length === 0) {
      toast.error('Choose at least one photo.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('Tag at least one child, or nobody will see these.');
      return;
    }

    const frozen = lockedStudentIds ?? selectedStudentIds;
    setLockedStudentIds(frozen);

    await startUpload(selectedClassId, frozen);

    // Invalidate photos query so the dashboard refreshes.
    queryClient.invalidateQueries({ queryKey: ['teacher-photos'] });
  }, [
    selectedClassId,
    images.length,
    selectedStudentIds,
    lockedStudentIds,
    startUpload,
    queryClient,
    toast,
  ]);

  // ── Retry one file ──────────────────────────────────────────────────
  const handleRetryImage = useCallback(
    (id: string) => {
      if (!selectedClassId) return;
      // The frozen set, so a retried photograph carries exactly the tags the
      // rest of its batch carried.
      retryImage(id, selectedClassId, lockedStudentIds ?? selectedStudentIds);
    },
    [selectedClassId, lockedStudentIds, selectedStudentIds, retryImage],
  );

  // ── Clear the batch ─────────────────────────────────────────────────
  const handleShareMore = useCallback(() => {
    const banked = lockedStudentIds ?? [];
    if (completedCount > 0 && banked.length > 0) {
      setTagLedger((prev) => {
        const next = { ...prev };
        for (const id of banked) {
          next[id] = (next[id] ?? 0) + completedCount;
        }
        return next;
      });
    }

    resetUpload();
    setLockedStudentIds(null);
    // Cleared rather than kept: the next batch is a different set of children
    // far more often than it is the same one, and a stale tick sends a
    // photograph to a family whose child is not in it.
    setSelectedStudentIds([]);
  }, [lockedStudentIds, completedCount, resetUpload]);

  /**
   * A finished batch does not survive leaving the screen.
   *
   * Before this, the only thing that cleared a completed batch was the "Share
   * more" button. Switching to Class and back left the teacher looking at last
   * batch's "Sent" ticks and "Shared with 1 family", with the primary action
   * reading "Share more" instead of offering to choose photographs — so the
   * screen appeared stuck on a job that was already done.
   *
   * Two things this deliberately does **not** do:
   *
   *  - It never touches a batch that is still going. A teacher who switches
   *    tabs mid-upload comes back to their upload, not to an empty screen.
   *  - It banks the tag ledger on the way out, by going through the same
   *    `handleShareMore` the button uses. The "Today so far" counts are the
   *    session's coverage record — the answer to "who have I still not
   *    photographed" — and dropping them on a tab switch would quietly lose
   *    the one number this screen exists to accumulate.
   */
  const completedBatchRef = useRef(false);
  completedBatchRef.current = isComplete;
  const clearBatchRef = useRef(handleShareMore);
  clearBatchRef.current = handleShareMore;

  useFocusEffect(
    useCallback(
      () => () => {
        if (completedBatchRef.current) clearBatchRef.current();
      },
      [],
    ),
  );

  // A batch can also end by being emptied: every photograph in it failed and
  // the teacher dropped them one by one. There is no batch left to protect, so
  // the freeze lifts and the next one starts clean — otherwise the rail stays
  // read-only against photographs that no longer exist, and the teacher can
  // pick new ones but cannot say who is in them.
  useEffect(() => {
    if (images.length === 0 && lockedStudentIds !== null) {
      setLockedStudentIds(null);
      setSelectedStudentIds([]);
    }
  }, [images.length, lockedStudentIds]);

  // ── Computed state ──────────────────────────────────────────────────
  const hasImages = images.length > 0;
  const failedCount = images.filter((img) => img.state === 'error').length;
  const pendingCount = images.filter(
    (img) => img.state === 'idle' || img.state === 'error',
  ).length;
  const railLocked = lockedStudentIds !== null;
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // At least one tagged child is required, not optional: the parent feed is
  // built by joining photo_student_tags, and nothing in the app can tag a
  // photo once it has been uploaded.
  const canUpload =
    hasImages &&
    !!selectedClassId &&
    selectedStudentIds.length > 0 &&
    !isUploading &&
    !isComplete;

  const taggedCount = (lockedStudentIds ?? selectedStudentIds).length;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar
        large
        title="Share photos"
        eyebrow={selectedClass?.name ?? undefined}
        subtitle={
          hasImages
            ? `${images.length} photo${images.length === 1 ? '' : 's'} in this batch`
            : undefined
        }
      />

      <View style={styles.body}>
        {/* Which class these belong to. Once a batch is in flight it is a
            statement rather than a control — changing class mid-upload would
            file half a batch under one register and half under another. */}
        {railLocked ? (
          <View style={styles.classLocked}>
            <Ionicons name="school-outline" size={17} color={colors.text.secondary} />
            <Text variant="bodySmall" color={colors.text.secondary}>
              {selectedClass?.name ?? 'This class'}
            </Text>
          </View>
        ) : (
          <ClassSelector
            classes={classes}
            selectedId={selectedClassId}
            onSelect={handleClassSelect}
            label="Class"
            placeholder="Select a class"
            style={styles.classSelector}
          />
        )}

        {/* The photographs. Nothing picked yet is the screen's resting state,
            not a failure, so it gets the drawing and the one italic line this
            screen is allowed — and both disappear the moment a real photograph
            is on screen, which is the rule about illustrations competing with
            photography. */}
        {!hasImages ? (
          <View style={styles.startPanel}>
            <StackOfPrints wash />
            <Text variant="editorial" center style={styles.startLine}>
              Today, as they saw it.
            </Text>
            <Text variant="bodySmall" muted center style={styles.startBody}>
              Pick up to {MAX_UPLOAD_IMAGES} photos, say who is in them, and every
              tagged child&apos;s family sees them in their feed. Nobody else does.
            </Text>
          </View>
        ) : (
          <UploadPreview
            images={images}
            onRemove={removeImage}
            onRetry={handleRetryImage}
            style={styles.preview}
          />
        )}

        {/* Finished. A small cheering Bo and a sentence — and deliberately
            **no confetti**, which is the one thing on this screen the playful
            revamp did not add. The batch already spent its one Success haptic,
            and a teacher runs this flow every working day: anything louder
            becomes a delay by Wednesday. A 44px bee with her arms up is warmth
            that costs no time. */}
        {isComplete && (
          <Reveal scale style={styles.doneRow}>
            <Bo pose="cheer" size={44} />
            <Text variant="bodySmallBold" color={colors.success.main}>
              {`Shared with ${taggedCount} famil${taggedCount === 1 ? 'y' : 'ies'}`}
            </Text>
          </Reveal>
        )}
      </View>

      {/* ── The dock ───────────────────────────────────────────────────
          Pinned, so the rail is under the thumb wherever the pager has got
          to. It carries its own ground and a hairline, because a photograph
          scrolls underneath it. */}
      <View style={[styles.dock, { paddingBottom: dockInset }]}>
        {/* The rail stays on screen between batches on purpose. Its counts are
            the session's coverage record, and "who have I still not
            photographed today" is the question a teacher asks precisely when
            there are no photographs in hand. */}
        <View style={styles.dockHead}>
          <Text variant="bodySmallBold">
            {hasImages ? 'Who is in them?' : 'Today so far'}
          </Text>
          {taggedCount > 0 && (
            <Text variant="caption" muted numberOfLines={1} style={styles.dockCount}>
              {`${taggedCount} tagged`}
            </Text>
          )}
        </View>

        <StudentRail
          students={students}
          nameFor={nameFor}
          selectedIds={lockedStudentIds ?? selectedStudentIds}
          countFor={countFor}
          loading={studentsLoading}
          error={studentsError}
          locked={railLocked}
          hasClass={!!selectedClassId}
          onToggle={toggleStudent}
          onRetry={handleRetryStudents}
        />

        {/* The one line that says what is missing, right above the button that
            is refusing to work. It was labelled "Optional" once, which made
            silently invisible photographs the easiest outcome to produce. */}
        {hasImages && !railLocked && selectedStudentIds.length === 0 && (
          <View style={styles.hint}>
            <Ionicons name="information-circle" size={16} color={colors.text.accent} />
            <Text variant="caption" color={colors.text.accent} style={styles.hintText}>
              Tag at least one child. A photo only reaches the families of the
              children in it.
            </Text>
          </View>
        )}

        {isUploading && (
          <Text variant="caption" muted style={styles.sendingLine}>
            {`Sending — ${completedCount} of ${images.length} done. Keep this screen open.`}
          </Text>
        )}

        <View style={styles.dockActions}>
          {!hasImages ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handlePickImages}
              leftIcon={(color) => (
                <Ionicons name="images-outline" size={20} color={color} />
              )}
            >
              Choose photos
            </Button>
          ) : isComplete ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleShareMore}
              leftIcon={(color) => <Ionicons name="add" size={20} color={color} />}
            >
              Share more
            </Button>
          ) : (
            <>
              {!railLocked && (
                <Button
                  variant="outline"
                  onPress={handlePickImages}
                  disabled={isUploading}
                  accessibilityLabel="Add more photos to this batch"
                  leftIcon={(color) => (
                    <Ionicons name="add" size={18} color={color} />
                  )}
                >
                  {`${images.length}/${MAX_UPLOAD_IMAGES}`}
                </Button>
              )}
              <Button
                variant="primary"
                // `md`, not `lg`. This button does not get the row to itself —
                // it shares it with the "+ n/20" control — and `lg`'s padding
                // left about 300px for a label that needs 330, so the primary
                // action truncated itself to "Share 3 pho…". Dropping the icon
                // was not enough; the padding is what eats the width. Verified
                // on a device at 1240x2772.
                size="md"
                onPress={handleStartUpload}
                disabled={!canUpload}
                loading={isUploading}
                style={styles.sendButton}
                leftIcon={(color) => (
                  <Ionicons name="cloud-upload-outline" size={18} color={color} />
                )}
              >
                {failedCount > 0 && !isUploading
                  ? `Try ${failedCount} again`
                  : `Share ${pendingCount} photo${pendingCount === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </View>

        {/* A batch that half-landed. The rows above carry a retry each; this
            says how many there are without making the teacher count them. */}
        {failedCount > 0 && !isUploading && (
          <Text variant="caption" color={colors.error.main} style={styles.sendingLine}>
            {`${failedCount} didn't send. Retry or drop them above, or send them all again.`}
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// The rail
// ---------------------------------------------------------------------------

interface StudentRailProps {
  students: StudentItem[];
  nameFor: Record<string, string>;
  selectedIds: string[];
  countFor: (id: string) => number;
  loading: boolean;
  error: boolean;
  locked: boolean;
  hasClass: boolean;
  onToggle: (id: string) => void;
  onRetry: () => void;
}

/**
 * The rail itself, with the four states a list owes: a delayed skeleton shaped
 * like the chips it stands in for, a failed request that says so and offers a
 * retry, a class with nobody in it, and the children.
 *
 * A locked rail renders the same chips without `onPress`, which `Chip` treats
 * as a static tag rather than a control — so the record of what this batch was
 * tagged with stays in the same vocabulary the choice was made in, instead of
 * turning into a different-looking summary.
 */
function StudentRail({
  students,
  nameFor,
  selectedIds,
  countFor,
  loading,
  error,
  locked,
  hasClass,
  onToggle,
  onRetry,
}: StudentRailProps) {
  if (loading) {
    return (
      <View style={styles.railStates}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonShimmer
            key={i}
            width={i % 2 === 0 ? 92 : 74}
            height={CHIP_RAIL_HEIGHT}
            borderRadius={radius.xs}
            index={i}
          />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.railStates}>
        <Text variant="bodySmall" color={colors.error.main} style={styles.railMessage}>
          Couldn&apos;t load this class.
        </Text>
        <Button variant="ghost" size="sm" onPress={onRetry}>
          Try again
        </Button>
      </View>
    );
  }

  if (!hasClass) {
    return (
      <View style={styles.railStates}>
        <Text variant="bodySmall" muted>
          Choose a class to see its children.
        </Text>
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={styles.railStates}>
        <Text variant="bodySmall" muted>
          Nobody is enrolled in this class yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      keyboardShouldPersistTaps="handled"
    >
      {students.map((student) => {
        const selected = selectedIds.includes(student.id);
        const count = countFor(student.id);
        return (
          <Chip
            key={student.id}
            selected={selected}
            count={count}
            onPress={locked ? undefined : () => onToggle(student.id)}
            accessibilityLabel={
              locked
                ? `${student.name}, tagged in ${count} photos`
                : `${student.name}${selected ? ', tagged' : ''}${count > 0 ? `, ${count} photos` : ''}`
            }
          >
            {nameFor[student.id] ?? student.name}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** Matches `Chip`'s own visual height so the skeleton does not reflow. */
const CHIP_RAIL_HEIGHT = 36;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    gap: spacing.ms,
  },
  classSelector: {
    marginBottom: spacing.xs,
  },
  classLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  preview: {
    flex: 1,
  },
  startPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  startLine: {
    marginTop: spacing.sm,
  },
  startBody: {
    maxWidth: 300,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // ── Dock ───────────────────────────────────────────────────────────
  dock: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.ms,
    gap: spacing.sm,
    backgroundColor: colors.background.cream,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border.light,
  },
  dockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  dockCount: {
    flex: 1,
    textAlign: 'right',
  },
  rail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.xxs,
  },
  railStates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: CHIP_RAIL_HEIGHT,
  },
  railMessage: {
    flexShrink: 1,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  hintText: {
    flex: 1,
  },
  sendingLine: {
    marginTop: spacing.xxs,
  },
  dockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sendButton: {
    flex: 1,
  },
});
