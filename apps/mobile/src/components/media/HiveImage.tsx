import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { Image, type ContentFit } from 'expo-image';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HiveImageProps {
  /** Remote or local image URI. */
  uri: string;
  /** Optional blurhash string shown as a placeholder while loading. */
  blurhash?: string;
  /** How the image should be resized to fit its container. @default 'cover' */
  contentFit?: ContentFit;
  /** Image transition duration in milliseconds. @default 300 */
  transition?: number;
  /** Optional style overrides for the image. */
  style?: StyleProp<ImageStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HiveImage>` — themed image component backed by `expo-image`.
 *
 * Automatically shows a blurhash placeholder while the network image loads,
 * then cross-fades to the real image.
 *
 * ```tsx
 * <HiveImage
 *   uri="https://example.com/photo.jpg"
 *   blurhash="LKO2?U%2Tw=w]~RBVZRi};RPxuwH"
 *   style={{ width: 200, height: 200, borderRadius: 12 }}
 * />
 * ```
 */
export function HiveImage({
  uri,
  blurhash,
  contentFit = 'cover',
  transition = 300,
  style,
}: HiveImageProps) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash ? { blurhash } : undefined}
      contentFit={contentFit}
      transition={transition}
      style={style}
    />
  );
}

export default HiveImage;
