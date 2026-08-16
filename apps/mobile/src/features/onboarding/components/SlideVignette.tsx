import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  spring,
  travel,
  STAGGER_STEP,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui';
import { MiniMount } from './MiniMount';
import type { VignetteKind } from '../data/slides';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideVignetteProps {
  kind: VignetteKind;
  /** True once this slide has come into view. Drives the entrance. */
  active: boolean;
  /** Width available for the composition. */
  width: number;
}

// ---------------------------------------------------------------------------
// Timing
//
// All of it derived from `STAGGER_STEP` and `travel`, so the intro carousel
// arrives on the same beat as every list in the app rather than on three
// numbers somebody once liked.
// ---------------------------------------------------------------------------

/** Before the first piece moves, in ms. */
const PIECE_BASE = STAGGER_STEP;

/** How long each piece waits behind the one before it, in ms. */
const PIECE_STEP = STAGGER_STEP * 2;

/** The highest `order` any composition below hands to a `<Piece>`. */
const MAX_PIECE_ORDER = 2;

/**
 * When the last piece of the illustration starts moving, in ms.
 *
 * Published because `<OnboardingSlide>` starts its caption here: the picture
 * and its words are one choreography, not two staggered groups racing each
 * other, and the caption should follow this file rather than restate it.
 */
export const VIGNETTE_SETTLED_AT = PIECE_BASE + MAX_PIECE_ORDER * PIECE_STEP;

/** How far an arriving piece travels, in px. */
const PIECE_RISE = travel.section;

/**
 * What every transition here collapses to under Reduce Motion.
 *
 * Zero is the absence of an animation rather than a duration somebody picked:
 * the piece is simply in place. Spelled out as a named constant because a bare
 * `{ duration: 0 }` inline is indistinguishable at a glance from the inline
 * magic numbers the motion system exists to stop.
 *
 * Exported so the caption alongside these pieces shares one definition. Moti
 * runs its own loop and never reads Reanimated's `ReduceMotion.System` flag, so
 * every animated surface in this feature has to make the same explicit choice.
 */
export const NO_MOTION = { type: 'timing', duration: 0 } as const;

/** How far back the other families' photos sit on the privacy slide. */
const DIMMED = 0.45;

// ---------------------------------------------------------------------------
// Photograph tints
// ---------------------------------------------------------------------------

/**
 * The gradients standing in for photographs.
 *
 * Deliberately warm and bright: these read as pictures taken in a sunlit
 * classroom, not as UI swatches. An earlier pass ran each hue from its light
 * to its *dark* end, which made three heavy, cold rectangles sitting on warm
 * paper — the one thing the palette is built to avoid.
 */
const PHOTO = {
  sun: { from: colors.primary.amberLight, to: colors.primary.amber },
  leaf: { from: colors.primary.mintLight, to: colors.primary.mint },
  rose: { from: colors.primary.roseLight, to: colors.primary.rose },
  plum: { from: colors.primary.lavenderLight, to: colors.primary.lavender },
  muted: { from: colors.gray[200], to: colors.gray[400] },
} as const;

/** Every vignette is composed inside a square of this width. */
function stageUnit(width: number): number {
  return Math.min(width, 300);
}

// ---------------------------------------------------------------------------
// A single piece
// ---------------------------------------------------------------------------

/**
 * One element of a composition, rising and fading into place on its own slice
 * of the slide's progress.
 *
 * The spring is `spring.gentle` (ζ 0.74) rather than the `{ damping: 17,
 * stiffness: 170, mass: 0.9 }` it used to carry — ζ 0.69, under the 0.7 house
 * floor, on a piece travelling 24px and scaling at the same time. Moti does not
 * read Reanimated's `reduceMotion` flag, so the branch is explicit: with the
 * setting on, every piece is simply in place from the start.
 */
function Piece({
  active,
  order,
  /** Ceiling on the piece's opacity once it has arrived. */
  dim = 1,
  reduced,
  style,
  children,
}: {
  active: boolean;
  order: number;
  dim?: number;
  reduced: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <MotiView
      animate={{
        opacity: active ? dim : 0,
        translateY: active || reduced ? 0 : PIECE_RISE,
        scale: active || reduced ? 1 : 0.94,
      }}
      transition={
        reduced
          ? NO_MOTION
          : {
              type: 'spring',
              damping: spring.gentle.damping,
              stiffness: spring.gentle.stiffness,
              mass: spring.gentle.mass,
              delay: active ? PIECE_BASE + order * PIECE_STEP : 0,
            }
      }
      style={[styles.abs, style]}
    >
      {children}
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SlideVignette>` — the illustration for one intro slide.
 *
 * Built from the app's own photo mounts rather than a stock icon in a tinted
 * square. Onboarding used to assert three things about the product without
 * showing any of them; each slide now demonstrates its claim with the object
 * the parent will be looking at all year.
 */
export function SlideVignette({ kind, active, width }: SlideVignetteProps) {
  if (kind === 'feed') return <FeedVignette active={active} width={width} />;
  if (kind === 'private') return <PrivateVignette active={active} width={width} />;
  return <PrintsVignette active={active} width={width} />;
}

interface VignetteProps {
  active: boolean;
  width: number;
}

// ---------------------------------------------------------------------------
// 1. The feed arriving
// ---------------------------------------------------------------------------

function FeedVignette({ active, width }: VignetteProps) {
  const reduced = useReducedMotion();
  const unit = stageUnit(width);
  const big = unit * 0.44;
  const small = unit * 0.34;

  return (
    <View style={[styles.stage, { width: unit, height: unit * 0.78 }]}>
      <Piece
        active={active}
        order={0}
        reduced={reduced}
        style={{ left: 0, top: unit * 0.1 }}
      >
        <MiniMount
          id="feed-a"
          width={small}
          ratio={0.8}
          from={PHOTO.rose.from}
          to={PHOTO.rose.to}
          scene="painting"
          tilt={-6}
        />
      </Piece>

      <Piece
        active={active}
        order={2}
        reduced={reduced}
        style={{ right: 0, top: 0 }}
      >
        <MiniMount
          id="feed-c"
          width={small}
          ratio={0.75}
          from={PHOTO.leaf.from}
          to={PHOTO.leaf.to}
          scene="outdoors"
          tilt={7}
        />
      </Piece>

      {/* On top, and the only one captioned — the two behind are there for
          rhythm, and three captions at this size is just noise. */}
      <Piece
        active={active}
        order={1}
        reduced={reduced}
        style={{ left: unit * 0.2, bottom: 0 }}
      >
        <MiniMount
          id="feed-b"
          width={big}
          ratio={0.84}
          from={PHOTO.sun.from}
          to={PHOTO.sun.to}
          scene="blocks"
          caption="by Meera ma'am"
          isNew
          tilt={-1.5}
        />
      </Piece>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Only your child
// ---------------------------------------------------------------------------

function PrivateVignette({ active, width }: VignetteProps) {
  const reduced = useReducedMotion();
  const unit = stageUnit(width);
  const main = unit * 0.42;
  const other = unit * 0.28;

  return (
    <View style={[styles.stage, { width: unit, height: unit * 0.78 }]}>
      {/* Two other families' photos: present, greyed, and out of reach. */}
      <Piece
        active={active}
        order={0}
        dim={DIMMED}
        reduced={reduced}
        style={{ left: 0, top: unit * 0.08 }}
      >
        <MiniMount
          id="priv-a"
          width={other}
          ratio={0.8}
          from={PHOTO.muted.from}
          to={PHOTO.muted.to}
          tilt={-8}
        />
      </Piece>

      <Piece
        active={active}
        order={0}
        dim={DIMMED}
        reduced={reduced}
        style={{ right: 0, top: unit * 0.04 }}
      >
        <MiniMount
          id="priv-c"
          width={other}
          ratio={0.75}
          from={PHOTO.muted.from}
          to={PHOTO.muted.to}
          tilt={9}
        />
      </Piece>

      <Piece
        active={active}
        order={1}
        reduced={reduced}
        style={{ left: unit * 0.29, top: 0 }}
      >
        <MiniMount
          id="priv-b"
          width={main}
          ratio={0.84}
          from={PHOTO.rose.from}
          to={PHOTO.rose.to}
          scene="story"
          caption="Aarav · Sunflower"
        />
      </Piece>

      {/* The claim, stamped across the one print that is yours.

          The padlock used to be drawn in `primary.amberLight`. Checked: it sits
          on `ink[900]`, where #FBD9A4 measures 12.84:1 and is perfectly legal —
          the 1.35:1 failure that colour is known for only happens on paper. It
          is `text.onInk` now anyway, because a second near-white tone beside a
          `text.onInk` label was a colour distinction carrying no information,
          and the glyph is the outline cut like every other icon in the app. */}
      <Piece
        active={active}
        order={2}
        reduced={reduced}
        style={styles.chipSlot}
      >
        <View style={styles.inkChip}>
          <Ionicons
            name="lock-closed-outline"
            size={13}
            color={colors.text.onInk}
          />
          <Text variant="captionBold" onInk>
            Only Aarav&apos;s family
          </Text>
        </View>
      </Piece>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3. Prints
// ---------------------------------------------------------------------------

function PrintsVignette({ active, width }: VignetteProps) {
  const reduced = useReducedMotion();
  const unit = stageUnit(width);
  const main = unit * 0.44;

  return (
    <View style={[styles.stage, { width: unit, height: unit * 0.78 }]}>
      {/* The rest of the order, stacked behind. */}
      <Piece
        active={active}
        order={0}
        reduced={reduced}
        style={{ left: unit * 0.16, top: 0 }}
      >
        <MiniMount
          id="print-back"
          width={main * 0.88}
          ratio={0.8}
          from={PHOTO.plum.from}
          to={PHOTO.plum.to}
          scene="snack"
          tilt={8}
        />
      </Piece>

      <Piece
        active={active}
        order={1}
        reduced={reduced}
        style={{ left: unit * 0.04, top: unit * 0.12 }}
      >
        <MiniMount
          id="print-front"
          width={main}
          ratio={0.84}
          from={PHOTO.sun.from}
          to={PHOTO.sun.to}
          scene="outdoors"
          caption="Sports day"
          tilt={-3}
        />
      </Piece>

      {/* A price tag, in the currency the parent actually pays in. */}
      <Piece
        active={active}
        order={2}
        reduced={reduced}
        style={{ right: 0, bottom: unit * 0.1 }}
      >
        <View style={styles.priceTag}>
          <Text variant="price" color={colors.ink[900]}>
            ₹30
          </Text>
          {/* Ink, not the accent: the accent is a dark amber, and dark amber
              on marigold is barely a shade apart. */}
          <Text variant="tiny" color={colors.ink[700]}>
            4×6 print
          </Text>
        </View>
      </Piece>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'flex-start',
  },
  abs: {
    position: 'absolute',
  },
  chipSlot: {
    left: '14%',
    bottom: 0,
  },
  inkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderRadius: radius.pill,
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.medium),
  },
  priceTag: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
    // The mount's own corner, not the input scale's. It keeps this slide to
    // four radii — print, mount, button, pill — and a paper tag pinned to a
    // stack of prints should be cut like the prints.
    borderRadius: radius.mount,
    backgroundColor: colors.primary.amber,
    ...platformShadow(shadows.medium),
  },
});

export default SlideVignette;
