import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout, shadows, platformShadow } from '@/theme';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineBannerProps {
  /** Whether the device is currently offline. */
  visible: boolean;
}

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
 * ```tsx
 * <OfflineBanner visible={isOffline} />
 * ```
 */
export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(200)}
      style={styles.row}
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Ionicons name="cloud-offline" size={15} color={colors.primary.amberLight} />
        <Text variant="captionBold" onInk>
          Offline — showing what's saved
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
