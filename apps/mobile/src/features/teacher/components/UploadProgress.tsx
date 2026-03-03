import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
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
// Helpers
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<ImageUploadState, string> = {
  idle: 'Ready',
  hashing: 'Verifying...',
  'requesting-url': 'Preparing...',
  uploading: 'Uploading...',
  saving: 'Saving...',
  tagging: 'Tagging...',
  complete: 'Done',
  error: 'Failed',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UploadProgress>` -- per-image progress indicator.
 *
 * Displays the current state text, a honeycomb-styled progress bar,
 * and contextual icons (checkmark for complete, retry button for error).
 */
export function UploadProgress({
  state,
  progress,
  error,
  onRetry,
}: UploadProgressProps) {
  const isError = state === 'error';
  const isComplete = state === 'complete';
  const isActive =
    state !== 'idle' && state !== 'complete' && state !== 'error';

  return (
    <View style={styles.container}>
      {/* State label row */}
      <View style={styles.labelRow}>
        {isComplete && (
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={colors.success.main}
            style={styles.stateIcon}
          />
        )}
        {isError && (
          <Ionicons
            name="alert-circle"
            size={14}
            color={colors.error.main}
            style={styles.stateIcon}
          />
        )}
        <Text
          variant="caption"
          color={
            isError
              ? colors.error.dark
              : isComplete
                ? colors.success.dark
                : colors.text.secondary
          }
          numberOfLines={1}
          style={styles.stateText}
        >
          {isError && error ? error : STATE_LABELS[state]}
        </Text>

        {isError && onRetry && (
          <Pressable
            onPress={onRetry}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Retry upload"
            style={styles.retryButton}
          >
            <Ionicons
              name="refresh"
              size={14}
              color={colors.primary.amber}
            />
          </Pressable>
        )}
      </View>

      {/* Progress bar (shown when active or complete) */}
      {(isActive || isComplete) && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: isComplete
                  ? colors.success.main
                  : colors.primary.amber,
              },
            ]}
          />
        </View>
      )}

      {/* Error bar */}
      {isError && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: colors.error.main,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 4;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  stateIcon: {
    marginRight: 3,
  },
  stateText: {
    flex: 1,
  },
  retryButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  progressTrack: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.gray[200],
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
});

export default UploadProgress;
