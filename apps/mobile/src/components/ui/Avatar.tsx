import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { colors, fontFamily, layout } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Remote or local image URI. */
  uri?: string | null;
  /** Display name used to derive fallback initials (first two letters). */
  name?: string;
  /** Preset size. */
  size?: AvatarSize;
  /** Optional border color for active / highlight states (e.g. amber ring). */
  borderColor?: string;
  /** Border width when `borderColor` is set. Defaults to 2. */
  borderWidth?: number;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
};

const FONT_SCALE: Record<AvatarSize, number> = {
  sm: 12,
  md: 16,
  lg: 24,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive up-to-two uppercase initials from a name. */
function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Simple deterministic colour from a string — used for the fallback circle. */
const FALLBACK_COLORS = [
  colors.primary.amber,
  colors.primary.blue,
  colors.primary.mint,
  colors.primary.lavender,
  colors.primary.amberDark,
  colors.primary.blueDark,
  colors.primary.mintDark,
  colors.primary.lavenderDark,
];

function getColorFromName(name?: string): string {
  if (!name) return FALLBACK_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Avatar>` — circular profile image with initial-letter fallback.
 *
 * Uses `expo-image` for performant caching and blurhash support.
 *
 * ```tsx
 * <Avatar uri={user.avatarUrl} name={user.displayName} size="md" />
 * <Avatar name="Jane Doe" size="lg" borderColor={colors.primary.amber} />
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
  const fallbackBg = useMemo(() => getColorFromName(name), [name]);

  const [imgError, setImgError] = useState(false);
  const showImage = !!uri && !imgError;

  const outerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: layout.avatarRadius,
    overflow: 'hidden',
    ...(borderColor
      ? { borderColor, borderWidth: borderWidthProp }
      : {}),
  };

  return (
    <View style={[outerStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: fallbackBg }]}>
          <Text
            variant="captionBold"
            color={colors.white}
            style={{
              fontFamily: fontFamily.bodySemiBold,
              fontSize: initialsSize,
              lineHeight: initialsSize * 1.2,
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
