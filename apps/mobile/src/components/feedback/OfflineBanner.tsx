import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  radius,
  layout,
  shadows,
  platformShadow,
  duration,
} from '@/theme';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineBannerProps {
  /** Whether the device is currently offline. */
  visible: boolean;
  /**
   * Overrides the sentence. Say what is still available rather than what has
   * been lost — "Offline — showing yesterday's photos" beats "No connection".
   */
  message?: string;
  /** Extra style for the row, for a screen that needs its own spacing. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MESSAGE = "Offline — showing what's saved";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OfflineBanner>` — shown while the device has no connection.
 *
 * A small ink pill in the flow of the screen rather than a red bar pinned over
 * the header. Losing signal is a condition, not an error: the app still shows
 * everything already loaded, so the notice states the fact and gets out of the
 * way instead of alarming a parent who is on a train.
 *
 * **There is deliberately no Retry.** Connectivity comes back on its own and
 * the screens that use this already refetch when it does, so a button here
 * would be a control that does nothing the app was not going to do anyway — and
 * one that reads as broken every time it is pressed in a tunnel. Retries belong
 * on the request that failed, in `EmptyState variant="error"`.
 *
 * Neutral on purpose, down to the icon: marigold is the app's one acting
 * accent, and a condition nobody can act on is not where it should be spent.
 * The pill sits in the flow rather than over the content, so nothing it covers
 * is hidden and nothing reflows when it goes.
 *
 * ```tsx
 * <OfflineBanner visible={isOffline} />
 * ```
 */
export function OfflineBanner({ visible, message, style }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(duration.base).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(duration.exit).reduceMotion(ReduceMotion.System)}
      style={[styles.row, style]}
      accessibilityRole="alert"
      // iOS takes the announcement from the alert role; Android needs the live
      // region. A parent who cannot see the pill is the person most likely to
      // be wondering why nothing new has arrived.
      accessibilityLiveRegion="polite"
    >
      <View style={styles.pill}>
        <Ionicons name="cloud-offline" size={15} color={colors.text.onInkMuted} />
        <Text variant="captionBold" onInk>
          {message ?? DEFAULT_MESSAGE}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.small),
  },
});

export default OfflineBanner;
