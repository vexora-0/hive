import React, { useEffect } from 'react';
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
import { Text } from '@/components/ui';
import type { ImageUploadState } from '@/features/teacher/hooks/useUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadProgressProps {
  /** Current pipeline state for this image. */
  state: ImageUploadState;
  /** Upload progress 0-1. */
  progress: number;
  /** Error message when state is 'error'. */
  error?: string;
  /** Retry handler for failed uploads. */
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Copy
//
// Exhaustive over `ImageUploadState` — adding a state to that union deliberately
// breaks this map, so the new state gets a sentence instead of falling through.
//
// The register is plain and present-tense. "Requesting upload URL" is what the
// code is doing; "Getting ready" is what the teacher is waiting for, and there
// is no working day on which the difference helps them.
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<ImageUploadState, string> = {
  idle: 'Ready to send',
  'requesting-url': 'Getting ready',
  uploading: 'Sending',
  saving: 'Saving',
  tagging: 'Tagging',
  confirming: 'Nearly there',
  complete: 'Sent',
  error: "Didn't send",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UploadProgress>` — one photograph's own progress, and its own retry.
 *
 * **There is deliberately no aggregate bar anywhere in this flow.** Twenty
 * photos over preschool wifi always exceed the ten seconds past which a single
 * bar stops being informative, and when the fourteenth fails the teacher has to
 * retry *that file* — a batch-level control would re-send the thirteen that
 * already landed. So progress is per file, failure is per file, and retry is
 * per file.
 *
 * State is carried by the word first and the colour second: a tick and "Sent",
 * a warning glyph and "Didn't send". Nothing here is legible only in colour.
 *
 * The bar fills with a timing curve rather than a spring — a spring on a width
 * that is being nudged forward every few hundred milliseconds fights its own
 * previous run and reads as a stutter.
 */
export function UploadProgress({
  state,
  progress,
  error,
  onRetry,
}: UploadProgressProps) {
  const isError = state === 'error';
  const isComplete = state === 'complete';
  const isActive = state !== 'idle' && state !== 'complete' && state !== 'error';

  const fill = useSharedValue(progress);

  useEffect(() => {
    fill.value = withTiming(progress, timing(duration.instant));
  }, [progress, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
  }));

  const statusColor = isError
    ? colors.error.main
    : isComplete
      ? colors.success.main
      : colors.text.secondary;

  // Marigold fills the bar because a bar is a **surface** — the one place the
  // app's single accent is allowed to be its saturated self. Nothing here is
  // read *off* the marigold: the state is said in words above it, in ink.
  const barColor = isError
    ? colors.error.main
    : isComplete
      ? colors.success.main
      : colors.primary.amber;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {isComplete && (
          <Ionicons
            name="checkmark-circle"
            size={15}
            color={colors.success.main}
            style={styles.stateIcon}
          />
        )}
        {isError && (
          <Ionicons
            name="alert-circle"
            size={15}
            color={colors.error.main}
            style={styles.stateIcon}
          />
        )}
        <Text
          variant="caption"
          color={statusColor}
          numberOfLines={1}
          style={styles.stateText}
        >
          {isError && error ? error : STATE_LABELS[state]}
        </Text>

        {/* A retry that failed to be tappable is not a retry. The label
            travels with the glyph and the row is a full 44 high. */}
        {isError && onRetry && (
          <Pressable
            onPress={onRetry}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Send this photo again"
            style={styles.retryButton}
          >
            <Ionicons name="refresh" size={15} color={colors.text.accent} />
            <Text variant="captionBold" color={colors.text.accent}>
              Retry
            </Text>
          </Pressable>
        )}
      </View>

      {(isActive || isComplete || isError) && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, fillStyle, { backgroundColor: barColor }]}
          />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 5;

/**
 * The retry control is 28 tall so the row stays compact under a photograph, and
 * `hitSlop` of `spacing.sm` on every side takes the *touch* target to exactly
 * `MIN_TAP_SIZE`.
 */
const RETRY_HEIGHT = MIN_TAP_SIZE - spacing.sm * 2;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  stateIcon: {
    marginRight: spacing.xs,
  },
  stateText: {
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: RETRY_HEIGHT,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  progressTrack: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.background.surfaceSecondary,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});

export default UploadProgress;
