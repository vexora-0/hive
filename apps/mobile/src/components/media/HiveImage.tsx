import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';

import { duration } from '@/theme';

// expo-image stopped exporting ContentFit. Declared locally rather than
// reaching into the package's internal types.
type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

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
  /**
   * How the blurhash is fitted while it stands in for the photo.
   *
   * Defaults to `contentFit`, because a placeholder fitted differently from the
   * image it replaces visibly jumps at the moment the photo arrives.
   */
  placeholderContentFit?: ContentFit;
  /** Image transition duration in milliseconds. @default `duration.base` */
  transition?: number;
  /**
   * **Set this on every image inside a recycled list.**
   *
   * `FlashList` reuses a cell's views for a different row as it scrolls. Without
   * a recycling key, `expo-image` keeps painting the *previous* row's photo
   * until the new one has decoded — in an app about other people's children,
   * that half-second of someone else's photograph reads as a data leak, not as
   * a loading state. Passing the photo's id blanks the view the instant the cell
   * is reused.
   *
   * Prefer the photo's **id** over its URI: a signed URL that refreshes would
   * otherwise blank a tile that is showing exactly the right photograph.
   */
  recyclingKey?: string;
  /**
   * Load order when several images are queued. Best effort, not a guarantee —
   * worth setting for the one photograph a screen exists to show.
   */
  priority?: 'low' | 'normal' | 'high';
  /** Where the decoded image is cached. @default 'disk' */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  /** Fires once the photo has decoded, carrying its intrinsic dimensions. */
  onLoad?: (event: ImageLoadEventData) => void;
  /** Fires when the photo could not be fetched or decoded. */
  onError?: () => void;
  /**
   * Left undefined by default: a photo inside a mount or a viewer is described
   * by the control that wraps it, and labelling both makes a screen reader read
   * the same photograph twice.
   */
  accessibilityLabel?: string;
  /** Optional style overrides for the image. */
  style?: StyleProp<ImageStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HiveImage>` — every photograph in the app goes through this component.
 *
 * It is a thin wrapper over `expo-image` that fixes the three things a
 * photograph in Hive always wants: a blurhash standing in while the network
 * catches up, a crossfade timed from the theme rather than from a number typed
 * into a screen, and a recycling key so a reused list cell never shows the
 * photo that was there before.
 *
 * ```tsx
 * <HiveImage
 *   uri={photo.uri}
 *   blurhash={photo.blurhash}
 *   recyclingKey={photo.id}
 *   style={{ width: 200, aspectRatio: 0.8, borderRadius: radius.print }}
 * />
 * ```
 */
export function HiveImage({
  uri,
  blurhash,
  contentFit = 'cover',
  placeholderContentFit,
  transition = duration.base,
  recyclingKey,
  priority,
  cachePolicy,
  onLoad,
  onError,
  accessibilityLabel,
  style,
}: HiveImageProps) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash ? { blurhash } : undefined}
      placeholderContentFit={placeholderContentFit ?? contentFit}
      contentFit={contentFit}
      transition={transition}
      recyclingKey={recyclingKey}
      priority={priority}
      cachePolicy={cachePolicy}
      onLoad={onLoad}
      onError={onError ? () => onError() : undefined}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}

export default HiveImage;
