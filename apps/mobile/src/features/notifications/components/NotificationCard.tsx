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

import {
  colors,
  spacing,
  radius,
  layout,
  shadows,
  platformShadow,
  spring,
  exitTiming,
  MIN_TAP_SIZE,
} from '@/theme';
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
// Type → glyph
//
// **One icon hand, and the hue is gone.** Each notification type used to get
// its own tinted tile — marigold, mint, peacock, plum — so a busy week produced
// a column of four different colours down the left edge of the screen. That is
// the category's most dating device (Brightwheel ships a twelve-colour tile
// grid, Procare thirteen multicolour stickers) and it was encoding something
// the glyph already says perfectly well: a camera is a photo, a cart is an
// order, a box is a delivery. Colour that repeats information is colour spent
// for nothing, and it cost the screen its calm.
//
// So every tile is now the same sunk-paper well and the drawing does the work.
// Outline glyphs throughout: fill is reserved for a selected state, and a
// notification row has none.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  new_photos: 'camera-outline',
  upload_complete: 'checkmark-circle-outline',
  new_order: 'cart-outline',
  order_status: 'cube-outline',
};

const FALLBACK_ICON: keyof typeof Ionicons.glyphMap = 'notifications-outline';

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/**
 * How long ago, said the way a person would say it.
 *
 * **No machine timestamps anywhere near a photograph.** "2024-08-12T09:31:02Z"
 * and even "12/08/24 09:31" turn a note about a child into a log line, and a
 * parent scanning their inbox on the bus does not want to subtract dates. The
 * row is narrow, so the visible form stays short — the long form goes to the
 * screen reader through {@link describeAge}, which has all the room it needs.
 */
function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Last week';
  return `${weeks} weeks`;
}

/** The unabbreviated form, for the accessibility label. */
function describeAge(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Last week';
  return `${weeks} weeks ago`;
}

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

/** How far the card must travel before letting go marks it read. */
const SWIPE_THRESHOLD = 100;

/** How far the card is thrown once the threshold is passed, in px. */
const SWIPE_EXIT_DISTANCE = 400;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<NotificationCard>` — one line about something that happened.
 *
 * A quiet paper row: one glyph in a sunk well, the sentence, and how long ago.
 * Unread rows sit on the marigold wash and carry a rail down their leading
 * edge — **the rail is drawn in the readable marigold `text.accent`, not in
 * `primary.amber`.** That is not a preference. A 4px `#F0A03A` rail measures
 * 1.4:1 against the `#FDF0DC` wash it is drawn on, so the mark that says "you
 * have not read this" was invisible on precisely the rows that needed it, and
 * perfectly visible on the white read rows where it did not exist. `#9C5A10`
 * holds 4.8:1 on the wash.
 *
 * Swiping right pulls the card off an ink slot to mark it read. The slot is ink
 * rather than the old green slab: there is one swipe action, so colour is
 * disambiguating nothing, and a saturated bar sliding out from under every row
 * is the opposite of chrome that withdraws.
 */
export function NotificationCard({
  notification,
  onPress,
  onDismiss,
}: NotificationCardProps) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const isRead = notification.is_read;
  const iconName = ICON_MAP[notification.type] ?? FALLBACK_ICON;
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
  //
  // Both settle configs come from the theme. The spring-back used to run at
  // `{ damping: 15, stiffness: 300 }` — ζ ≈ 0.43, well under the 0.6 floor — on
  // a card that had travelled up to 100px, where that much overshoot reads as
  // the row bouncing rather than returning. `spring.gentle` is ζ 0.74.
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
        // Leaving is quicker than arriving — the user has already decided.
        translateX.value = withTiming(SWIPE_EXIT_DISTANCE, exitTiming());
        opacity.value = withTiming(0, exitTiming(), () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateX.value = withSpring(0, spring.gentle);
      }
    });

  // -- Animated styles ---------------------------------------------------
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // Driven straight off the finger and clamped, never sprung: a spring on
  // opacity clamps at 1.0 below ζ 1 and stalls at the end of its run.
  const animatedSlotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / SWIPE_THRESHOLD, 1),
  }));

  const accessibilityLabel = [
    isRead ? undefined : 'Unread.',
    notification.title,
    notification.body,
    describeAge(notification.created_at),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.wrapper}>
      {/* The slot the card slides off. Decorative — the action it stands for
          is announced by the card's own accessibility hint. */}
      <Animated.View
        style={[styles.slot, animatedSlotStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons
          name="checkmark-done-outline"
          size={22}
          color={colors.text.onInk}
        />
        <Text variant="captionBold" onInk>
          Read
        </Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.card, !isRead && styles.cardUnread, animatedCardStyle]}
        >
          <Pressable
            onPress={() => onPress?.(notification)}
            style={styles.pressable}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Opens what this is about. Swipe right to mark as read."
          >
            {/* Unread rail. A rail down the edge survives being glanced at from
                across a room; an 8px dot floating in the padding does not. */}
            {!isRead && <View style={styles.unreadRail} />}

            <View style={styles.tile}>
              <Ionicons name={iconName} size={20} color={colors.text.secondary} />
            </View>

            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text
                  variant={isRead ? 'bodySmall' : 'bodySmallBold'}
                  numberOfLines={2}
                  style={styles.title}
                >
                  {notification.title}
                </Text>
                <Text
                  variant="caption"
                  color={colors.text.tertiary}
                  style={styles.time}
                >
                  {relativeTime}
                </Text>
              </View>

              {notification.body && (
                <Text
                  variant="caption"
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

/** Width of the unread rail, in px. */
const RAIL_WIDTH = 4;

/** The tile the glyph sits in. Square-ish, and never the size of a photo. */
const TILE_SIZE = 40;

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.ms,
  },
  slot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.ink,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    gap: spacing.sm,
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
    paddingLeft: spacing.md + RAIL_WIDTH,
    // Comfortably past the 44pt floor: the whole row is the target.
    minHeight: MIN_TAP_SIZE + spacing.lg,
  },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    // The readable marigold, not `primary.amber` — see the component note.
    backgroundColor: colors.text.accent,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surfaceSecondary,
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
  time: {
    // Stops "Yesterday" wrapping under the title on a narrow phone.
    flexShrink: 0,
  },
  body: {
    marginTop: spacing.xxs,
  },
});

export default NotificationCard;
