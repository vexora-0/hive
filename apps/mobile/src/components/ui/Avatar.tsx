import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { colors, fontFamily, layout, identityPalette } from '@/theme';
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
  /** Preset size. */
  size?: AvatarSize;
  /** Ring colour for active / highlight states. */
  borderColor?: string;
  /** Ring width when `borderColor` is set. Defaults to 2. */
  borderWidth?: number;
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
 * name the thing you read.
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
  style,
}: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const initialsSize = FONT_SCALE[size];
  const initials = useMemo(() => getInitials(name), [name]);
  const identity = useMemo(() => identityPalette(name ?? ''), [name]);

  const [imgError, setImgError] = useState(false);
  const showImage = !!uri && !imgError;

  const outerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: layout.avatarRadius,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
    ...(borderColor ? { borderColor, borderWidth: borderWidthProp } : {}),
  };

  return (
    <View style={[outerStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={220}
          onError={() => setImgError(true)}
          accessibilityLabel={name ? `${name}'s photo` : undefined}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: identity.wash }]}>
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
