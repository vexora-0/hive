import React, { useCallback, useEffect } from 'react';
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

import { colors, spacing, radius, layout, shadows, platformShadow } from '@/theme';
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

/**
 * Each type gets a tile: a wash to sit on and the deep tone for the glyph.
 * The saturated hue is deliberately not used — a column of five saturated
 * squares reads as an error list.
 */
const ICON_TILE_MAP: Record<NotificationType, { wash: string; ink: string }> = {
  new_photos: { wash: colors.primary.amberWash, ink: colors.text.accent },
  upload_complete: { wash: colors.primary.mintWash, ink: colors.primary.mintDark },
  new_order: { wash: colors.primary.blueWash, ink: colors.primary.blueDark },
  order_status: { wash: colors.primary.lavenderWash, ink: colors.primary.lavenderDark },
};

const DEFAULT_TILE = {
  wash: colors.primary.amberWash,
  ink: colors.text.accent,
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
  const tile = ICON_TILE_MAP[notification.type] ?? DEFAULT_TILE;
  const relativeTime = formatRelativeTime(notification.created_at);

  const handleDismiss = useCallback(() => {
    onDismiss?.(notification);
  }, [notification, onDismiss]);

  // Reset the swipe animation whenever this component is showing a different
  // notification.
  //
  // Dismissing only marks the row read — it never leaves the list — so after
  // the invalidation the same row re-rendered into a component whose opacity
  // was still 0: an invisible gap. FlashList recycles cells across items too,
  // so an untouched notification could inherit a cell left at translateX 400
  // and render blank. Neither state was recoverable without killing the app.
  useEffect(() => {
    translateX.value = 0;
    opacity.value = 1;
  }, [notification.id, translateX, opacity]);

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
        <Animated.View
          style={[styles.card, !isRead && styles.cardUnread, animatedCardStyle]}
        >
          <Pressable
            onPress={() => onPress?.(notification)}
            style={styles.pressable}
            accessibilityRole="button"
            accessibilityLabel={`${isRead ? '' : 'Unread. '}${notification.title}. ${notification.body ?? ''}`}
          >
            {/* Unread rail. A rail down the edge survives being glanced at from
                across a room; an 8px dot floating in the padding does not. */}
            {!isRead && <View style={styles.unreadRail} />}

            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: tile.wash }]}>
              <Ionicons name={iconName} size={20} color={tile.ink} />
            </View>

            {/* Text content */}
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text
                  variant={isRead ? 'bodySmall' : 'bodySmallBold'}
                  numberOfLines={2}
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
                  variant="caption"
                  color={colors.text.tertiary}
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
    marginHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.ms,
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success.main,
    borderRadius: radius.lg,
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
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...platformShadow(shadows.small),
  },
  cardUnread: {
    backgroundColor: colors.primary.amberWash,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    minHeight: 72,
  },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary.amber,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
