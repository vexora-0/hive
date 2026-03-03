import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
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
 * `<OfflineBanner>` — a top-of-screen banner that slides in when the
 * device loses network connectivity.
 *
 * Shows a cloud-off icon and "You're offline" message on a warm
 * orange-red background. Slides out when connectivity is restored.
 *
 * ```tsx
 * const { isConnected } = useNetInfo();
 * <OfflineBanner visible={!isConnected} />
 * ```
 */
export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      style={styles.container}
    >
      <View style={styles.content}>
        <Ionicons
          name="cloud-offline-outline"
          size={18}
          color={colors.white}
          style={styles.icon}
        />
        <Text variant="bodySmall" color={colors.white}>
          You're offline
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.error.main,
    paddingTop: spacing.xl + spacing.md, // account for status bar
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
});

export default OfflineBanner;
