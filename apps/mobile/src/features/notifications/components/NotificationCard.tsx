import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui/Text';
import type { NotificationType } from '@/types/supabase';
import type { Notification } from '../services/notificationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationCardProps {
  /** The notification object to render. */
  notification: Notification;
  /** Called when the card is tapped. */
  onPress?: (notification: Notification) => void;
  /** Called when the card is swiped right to dismiss / mark as read. */
  onDismiss?: (notification: Notification) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  new_photos: 'camera-outline',
  upload_complete: 'checkmark-circle-outline',
  new_order: 'cart-outline',
  order_status: 'cube-outline',
};

const ICON_COLOR_MAP: Record<NotificationType, string> = {
  new_photos: colors.primary.amber,
  upload_complete: colors.primary.mint,
  new_order: colors.primary.blue,
  order_status: colors.primary.lavender,
};

/**
 * Return a human-readable relative time string.
 * E.g. "Just now", "5m", "2h", "3d".
 */
function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const created = new Date(dateString).getTime();
  const diffMs = now - created;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

// ---------------------------------------------------------------------------
// Swipe constants
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<NotificationCard>` -- renders a single notification with an icon,
 * title, body, relative timestamp, and an unread indicator.
 *
 * Swipe right to dismiss / mark as read.
 */
export function NotificationCard({
  notification,
  onPress,
  onDismiss,
}: NotificationCardProps) {
  const translateX = useSharedValue(0);
  const cardHeight = useSharedValue<number | undefined>(undefined);
  const opacity = useSharedValue(1);

  const isRead = notification.is_read;
  const iconName = ICON_MAP[notification.type] ?? 'notifications-outline';
  const iconColor = ICON_COLOR_MAP[notification.type] ?? colors.primary.amber;
  const relativeTime = formatRelativeTime(notification.created_at);

  const handleDismiss = useCallback(() => {
    onDismiss?.(notification);
  }, [notification, onDismiss]);

  // -- Pan gesture for swipe-to-dismiss ---------------------------------
  const panGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      // Only allow right swipe
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        // Animate out to the right, then call dismiss
        translateX.value = withTiming(400, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        // Spring back
        translateX.value = withSpring(0, { damping: 15, stiffness: 300 });
      }
    });

  // -- Animated styles ---------------------------------------------------
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / SWIPE_THRESHOLD, 1),
  }));

  return (
    <View style={styles.wrapper}>
      {/* Swipe background indicator */}
      <Animated.View style={[styles.swipeBackground, animatedBackgroundStyle]}>
        <Ionicons
          name="checkmark-done-outline"
          size={24}
          color={colors.white}
        />
        <Text variant="captionBold" color={colors.white} style={styles.swipeText}>
          Read
        </Text>
      </Animated.View>

      {/* Card content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          <Pressable
            onPress={() => onPress?.(notification)}
            style={styles.pressable}
            accessibilityRole="button"
            accessibilityLabel={`${notification.title}. ${notification.body ?? ''}`}
          >
            {/* Unread indicator dot */}
            {!isRead && <View style={styles.unreadDot} />}

            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: iconColor + '1F' },
              ]}
            >
              <Ionicons name={iconName} size={22} color={iconColor} />
            </View>

            {/* Text content */}
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text
                  variant={isRead ? 'body' : 'bodyBold'}
                  numberOfLines={1}
                  style={styles.title}
                >
                  {notification.title}
                </Text>
                <Text variant="caption" color={colors.text.tertiary}>
                  {relativeTime}
                </Text>
              </View>

              {notification.body && (
                <Text
                  variant="bodySmall"
                  color={colors.text.secondary}
                  numberOfLines={2}
                  style={styles.body}
                >
                  {notification.body}
                </Text>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary.mint,
    borderRadius: layout.cardRadius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    gap: spacing.sm,
  },
  swipeText: {
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: layout.cardRadius,
    // iOS shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    // Android shadow
    elevation: 2,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 72,
  },
  unreadDot: {
    position: 'absolute',
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.blue,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  body: {
    marginTop: 2,
  },
});

export default NotificationCard;
