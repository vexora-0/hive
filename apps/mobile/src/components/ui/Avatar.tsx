import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { colors, fontFamily, layout, duration, identityPalette } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Remote or local image URI. */
  uri?: string | null;
  /** Display name used for fallback initials and the fallback colour. */
  name?: string;
  /** Preset size, or an exact diameter in points. */
  size?: AvatarSize | number;
  /** Ring colour for active / highlight states. */
  borderColor?: string;
  /** Ring width when `borderColor` is set. Defaults to 2. */
  borderWidth?: number;
  /**
   * Gives the whole avatar one accessible name and hides its insides.
   *
   * Reach for this when the avatar stands alone — a row that shows only a face,
   * a switcher where the picture *is* the control. When the person's name is
   * already written beside the avatar, leave it off: the name is read from the
   * text, and repeating it here makes every row announce twice.
   */
  label?: string;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
  xl: 88,
};

const FONT_SCALE: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 23,
  xl: 30,
};

/** What the presets work out at, for a custom diameter. */
const FONT_RATIO = 0.36;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Up to two uppercase initials from a name. */
function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Avatar>` — a circular portrait with an initials fallback.
 *
 * The fallback is a tinted wash with the initials in the *deep* form of the
 * same hue, rather than white on a saturated fill. Saturated circles in five
 * different colours turn a class list into confetti; a wash keeps the child's
 * name the thing you read. Every wash/ink pair in `identityPalette` clears
 * 4.5:1 — marigold 4.81, rose 4.84, leaf 4.90, plum 5.22, peacock 5.25.
 *
 * Two things here are about lists rather than about avatars:
 *
 *  - **`recyclingKey`.** Avatars live in recycled rows, and without it a reused
 *    cell shows the previous child's face for a frame. In a product built on
 *    other people's children, that frame reads as a privacy breach.
 *  - **A failed image is remembered per URI, not per component.** The old
 *    boolean stuck to the recycled cell, so one broken photo turned every child
 *    that later landed in that row into initials.
 *
 * ```tsx
 * <Avatar uri={child.avatarUrl} name={child.fullName} size="md" />
 * ```
 */
export function Avatar({
  uri,
  name,
  size = 'md',
  borderColor,
  borderWidth: borderWidthProp = 2,
  label,
  style,
}: AvatarProps) {
  const dimension = typeof size === 'number' ? size : SIZE_MAP[size];
  const initialsSize =
    typeof size === 'number' ? Math.round(size * FONT_RATIO) : FONT_SCALE[size];
  const initials = useMemo(() => getInitials(name), [name]);
  const identity = useMemo(() => identityPalette(name ?? ''), [name]);

  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;

  const outerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: layout.avatarRadius,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
    ...(borderColor ? { borderColor, borderWidth: borderWidthProp } : {}),
  };

  return (
    <View
      style={[outerStyle, style]}
      accessible={label ? true : undefined}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={uri}
          transition={duration.fast}
          onError={() => setFailedUri(uri ?? null)}
          accessibilityLabel={
            label ? undefined : name ? `${name}'s photo` : undefined
          }
        />
      ) : (
        // Initials are a picture of a name, not a word: read aloud they are
        // "ay ess". The name itself is either in `label` or in the text beside
        // the avatar, so the fallback is hidden from assistive technology.
        <View
          style={[styles.fallback, { backgroundColor: identity.wash }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            color={identity.ink}
            style={{
              fontFamily: fontFamily.bodyBold,
              fontSize: initialsSize,
              lineHeight: initialsSize * 1.25,
              letterSpacing: 0.3,
            }}
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Avatar;
