import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  spring,
  pressScale,
  withAlpha,
} from '@/theme';

import { HiveImage } from './HiveImage';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoMountProps {
  /** Photo id — seeds the deterministic aspect ratio, and keys the recycling. */
  id: string;
  /** Image URI. */
  uri: string;
  /** Blurhash placeholder. */
  blurhash?: string;
  /** Caption printed in the mount's bottom margin. */
  caption?: string;
  /**
   * Marks the print as recent with a turned-back corner. Reserve it for
   * something a parent actually needs to spot — photos they have not seen.
   */
  isNew?: boolean;
  /** Forces a specific aspect ratio instead of the seeded one. */
  aspectRatio?: number;
  /**
   * The photograph's own pixel dimensions, when they are known.
   *
   * Given both, the mount prints at the photo's **true** ratio instead of a
   * seeded one — a landscape shot stays landscape. Clamped, because one 16:9
   * panorama in a two-column wall leaves a hole beside it and a 9:16 video
   * still would take the whole screen. Ignored unless both are present and
   * positive.
   */
  width?: number | null;
  height?: number | null;
  /** Fires on press. */
  onPress?: () => void;
  /** Fires on long press. */
  onLongPress?: () => void;
  /** Accessibility label. Composed from the caption when omitted. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Aspect ratios
// ---------------------------------------------------------------------------

/**
 * Print sizes, not arbitrary crops: a square, a 4:5 portrait and a 3:4. Seeding
 * from the id means a photo keeps its shape between renders and between
 * sessions, so the wall does not reshuffle every time the feed refetches.
 *
 * This is the **fallback**. When the API hands over `width` and `height`, the
 * real ratio wins — a seeded shape is a guess standing in for a fact.
 */
const PRINT_RATIOS = [1, 0.8, 0.75] as const;

/** How far from square a cell may go before it starts wrecking the column. */
const MIN_RATIO = 0.62;
const MAX_RATIO = 1.4;

function seededRatio(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return PRINT_RATIOS[Math.abs(hash) % PRINT_RATIOS.length];
}

function printRatio(
  id: string,
  explicit?: number,
  width?: number | null,
  height?: number | null,
): number {
  if (explicit && explicit > 0) return explicit;
  if (width && height && width > 0 && height > 0) {
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
  }
  return seededRatio(id);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * The mat around the print — even on three sides, twice as deep below.
 *
 * That asymmetry is the whole object. A framed print is cut with a weighted
 * bottom margin because an optically centred mat looks bottom-light, and it is
 * also where a caption is written. Even margins on four sides would turn the
 * mount straight back into an app card with a picture in it.
 */
const MAT = spacing.sm;
const MAT_BOTTOM = spacing.md;

/** The turned-back corner, in points. */
const FOLD = 18;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PhotoMount>` — a photograph mounted on paper. The app's signature object.
 *
 * A white mat with square-ish corners, an even margin on three sides and a
 * deeper one below, where the caption is printed. That uneven margin is the
 * whole trick: it is how a framed print is cut, and it is what stops the feed
 * reading as a grid of app cards.
 *
 * Three details do the rest of the work:
 *
 *  - **The print's corners stay sharp.** `radius.print` is 4 and never grows.
 *    Rounding a child's photograph to match the buttons around it is what made
 *    the old feed read as a template.
 *  - **A hairline holds the window.** Without it a photograph of a bright wall
 *    dissolves into the white mat and the print loses its edge.
 *  - **The recycling key is the photo's id**, so a cell reused mid-scroll never
 *    paints the previous child's photograph while the new one decodes.
 *
 * It replaces the earlier polaroid card, which tilted each photo by a random
 * few degrees. A child's photograph should not arrive crooked.
 *
 * ```tsx
 * <PhotoMount id={p.id} uri={p.uri} caption="by Meera ma'am" isNew onPress={open} />
 * ```
 */
export function PhotoMount({
  id,
  uri,
  blurhash,
  caption,
  isNew = false,
  aspectRatio,
  width,
  height,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}: PhotoMountProps) {
  const ratio = useMemo(
    () => printRatio(id, aspectRatio, width, height),
    [id, aspectRatio, width, height],
  );

  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.card, spring.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // "New" is drawn in marigold, and marigold is a colour some of this app's
  // parents cannot distinguish. The word travels with the label so the state
  // is never carried by the fold alone.
  const label =
    accessibilityLabel ??
    [isNew ? 'New photo' : 'Photo', caption].filter(Boolean).join('. ');

  const body = (
    <>
      <View style={styles.window}>
        <HiveImage
          uri={uri}
          blurhash={blurhash}
          recyclingKey={id}
          style={[styles.image, { aspectRatio: ratio }]}
        />
      </View>

      <View style={caption ? styles.marginCaptioned : styles.margin}>
        {caption ? (
          <Text variant="caption" muted numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>

      {isNew && <FoldedCorner />}
    </>
  );

  if (!onPress && !onLongPress) {
    return (
      <View
        style={[styles.mount, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        {body}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      style={[styles.mount, animatedStyle, style]}
    >
      {body}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// The turned-back corner
// ---------------------------------------------------------------------------

/**
 * The "not seen yet" mark: the mount's top-right corner turned back, showing a
 * marigold slip tucked behind the print.
 *
 * It was two CSS-triangle borders stacked on top of each other — a marigold
 * wedge over a lighter one — which produced a flat chevron that read as a
 * ribbon or a badge, and which poked a hard 90° point out of the mount's
 * rounded corner. Drawn instead as two paths: the exposed slip (following the
 * mount's own corner radius, so nothing sticks out) and the flap over it, in
 * the shade of paper's reverse, with a crease along the fold. Same 18pt of
 * screen; it now reads as paper rather than as a sticker.
 *
 * Marigold appears here as a **surface** — it is never asked to carry a word.
 */
function FoldedCorner() {
  const r = radius.mount;

  return (
    <View style={styles.fold} pointerEvents="none">
      <Svg width={FOLD} height={FOLD}>
        {/* The slip behind the print, revealed where the corner is turned back. */}
        <Path
          d={`M0 0 H${FOLD - r} A ${r} ${r} 0 0 1 ${FOLD} ${r} V${FOLD} Z`}
          fill={colors.primary.amber}
        />
        {/* The flap: the reverse of the paper, folded down over the print. */}
        <Path d={`M0 0 L${FOLD} ${FOLD} L0 ${FOLD} Z`} fill={colors.surface.sunk} />
        {/* The crease. One hairline is all it takes to sit the flap on top. */}
        <Line
          x1={0}
          y1={0}
          x2={FOLD}
          y2={FOLD}
          stroke={withAlpha(colors.ink[900], 0.14)}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  mount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: MAT,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  window: {
    borderRadius: radius.print,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
    // Holds the print's edge when the photograph itself is pale. A photo of a
    // bright classroom wall otherwise runs straight into the white mat.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.ink[900], 0.08),
  },
  image: {
    width: '100%',
  },
  /** No caption: the mat's deeper bottom edge, and nothing else. */
  margin: {
    height: MAT_BOTTOM,
  },
  /** With one: the gap the type sits in, then the same deeper edge below it. */
  marginCaptioned: {
    paddingTop: MAT,
    paddingBottom: MAT_BOTTOM,
    justifyContent: 'center',
  },
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: FOLD,
    height: FOLD,
  },
});

export default PhotoMount;
