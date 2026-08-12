import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type AnimationObject } from 'lottie-react-native';

import { colors, spacing, radius, travel } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/animation/Reveal';
import { LottieWrapper } from '@/components/animation/LottieWrapper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateAction {
  /** Button label — name the action, e.g. "Add a photo". */
  label: string;
  /** Button press handler. */
  onPress: () => void;
}

export interface EmptyStateProps {
  /** What is not here. One short line. */
  title: string;
  /** What to do about it. */
  message?: string;
  /** Ionicons name shown in the mark above the title. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Lottie animation shown instead of the icon mark.
   * Pass the return value of `require('./anim.json')`.
   */
  lottieSource?: AnimationObject | string;
  /** The way out. */
  action?: EmptyStateAction;
  /** Renders in the smaller inline form, for empty regions inside a screen. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<EmptyState>` — what a screen shows when it has nothing to show.
 *
 * An empty screen is an invitation, so the title says what is not here and the
 * action says what to do about it. The mark above is a paper tile, not a
 * cartoon: this screen appears when a parent opens the app hoping for a photo
 * of their child, and a bouncing illustration would be the wrong register.
 *
 * ```tsx
 * <EmptyState
 *   icon="images-outline"
 *   title="No photos yet"
 *   message="Your child's teacher hasn't shared anything this week."
 * />
 * ```
 */
export function EmptyState({
  title,
  message,
  icon,
  lottieSource,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {lottieSource ? (
        <Reveal scale>
          <LottieWrapper source={lottieSource} autoPlay loop style={styles.animation} />
        </Reveal>
      ) : icon ? (
        <Reveal scale distance={travel.section}>
          <View style={styles.mark}>
            <Ionicons name={icon} size={30} color={colors.text.accent} />
          </View>
        </Reveal>
      ) : null}

      <Reveal index={1}>
        <Text variant="h3" center>
          {title}
        </Text>
      </Reveal>

      {message && (
        <Reveal index={2}>
          <Text variant="body" muted center style={styles.message}>
            {message}
          </Text>
        </Reveal>
      )}

      {action && (
        <Reveal index={3} style={styles.actionRow}>
          <Button variant="primary" onPress={action.onPress}>
            {action.label}
          </Button>
        </Reveal>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  containerCompact: {
    flex: 0,
    paddingVertical: spacing.xl,
  },
  animation: {
    width: 180,
    height: 180,
    marginBottom: spacing.md,
  },
  /** A tinted paper tile, sized and cornered like a small mount. */
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.amberWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  message: {
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  actionRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});

export default EmptyState;
