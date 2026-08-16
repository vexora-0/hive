import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Polygon } from 'react-native-svg';

import {
  colors,
  play,
  spacing,
  layout,
  spring,
  hexPoints,
  withAlpha,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui';
import { Bo } from '@/components/mascot';
import { Doodle } from '@/components/decor';
import { NO_MOTION } from './SlideVignette';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandSlideProps {
  /** Width of one page. */
  width: number;
  /** True once the slide has come into view, and true from then on. */
  active: boolean;
}

/**
 * The tagline.
 *
 * Two halves, because the product is two promises and a parent deciding
 * whether to bother needs both: **the moments** (what they get) and **safely**
 * (why this rather than a class WhatsApp group, which is what Hive is actually
 * competing with). Six words, so it fits on one line on the narrowest phone
 * the app targets — a tagline that wraps stops being a tagline.
 */
const TAGLINE = 'Little moments, safely shared.';

/**
 * The comb, and why it is seven cells rather than five.
 *
 * The first version placed five hexagons by eye — one big, four small, tucked
 * around it at angles that looked about right. They did not tessellate. A comb
 * whose cells do not touch is not a comb; it is hexagons scattered on a
 * background, and that is exactly what it looked like.
 *
 * This is the real tiling. For a flat-top hexagon of circumradius `r`, the six
 * neighbours sit at **distance √3·r, at 30° + 60k**. Every edge meets its
 * neighbour's exactly, with no gap and no overlap, because those two figures
 * are the tiling — not an approximation of it. Computed, not eyeballed.
 *
 * Seven cells is the smallest arrangement that reads as *comb* rather than as
 * *hexagon*: one cell surrounded on all six sides is the unit the whole pattern
 * repeats from.
 */
const CELL_R = 36;
const RING_D = CELL_R * Math.sqrt(3);

const RING: readonly [number, number][] = [0, 1, 2, 3, 4, 5].map((k) => {
  const a = (Math.PI / 180) * (30 + 60 * k);
  return [100 + RING_D * Math.cos(a), 100 + RING_D * Math.sin(a)];
});

/**
 * How wide the whole mark is drawn, in px.
 *
 * The rosette's own bounding box on the 200 grid is 180 × 187 — five cell radii
 * across — so 200 leaves it a hair of margin inside its viewBox and nothing is
 * clipped at the six outer corners.
 */
const CREST_SIZE = 232;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<BrandSlide>` — the first page of the intro carousel, and the only one whose
 * job is to say what the app is called.
 *
 * The carousel used to open on "Your child's day, as it happens" and run three
 * pages of benefits without ever printing the product's name. Somebody could
 * read all of it, tap through, and arrive at a sign-in screen for something
 * they could not name. That is a strange thing for a first run to manage, and
 * a masthead in the corner was not enough of a fix — a corner logo is
 * furniture, not an introduction.
 *
 * So this page does one thing and then gets out of the way: the mark, the name
 * and a six-word tagline. No benefit copy, because the three pages behind it
 * are the benefit copy, and a first screen that already argues has nothing left
 * to open with.
 *
 * The mark is **a seven-cell comb with Bo sitting in the middle of it** — see
 * the note on `CELL_R` for why seven and why the tiling is computed. Its
 * geometry comes from the same `hexPoints` as the app mark, the tab puck, the
 * page indicator and the confetti, so all five are literally the same shape.
 */
export function BrandSlide({ width, active }: BrandSlideProps) {
  const reduced = useReducedMotion();

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.block}>
        {/*
          The mark: the comb, with Bo living in the middle of it.

          She is **in** the lockup rather than standing under it. There was a
          separate waving Bo below the tagline before, which left the mark to be
          carried by geometry alone and stranded her in a field of empty page
          with nothing to do. One bee, in the one place a bee belongs, and the
          mark now says hive *and* bee *and* somebody-lives-here in a single
          shape.

          She sits in front of the centre cell and breaks its edges slightly.
          Contained neatly inside it she reads as an icon in a slot; overlapping
          it she reads as sitting in it.
        */}
        <MotiView
          animate={{
            scale: active || reduced ? 1 : 0.72,
            opacity: active ? 1 : 0,
          }}
          transition={
            reduced ? NO_MOTION : { ...spring.alive, type: 'spring', delay: 60 }
          }
          style={styles.crest}
        >
          <Svg width={CREST_SIZE} height={CREST_SIZE} viewBox="0 0 200 200">
            {/* The ring recedes. Six cells at full marigold would make the
                mark a pattern with no centre. */}
            {RING.map(([cx, cy], i) => (
              <Polygon
                key={`${cx.toFixed(1)}-${cy.toFixed(1)}`}
                points={hexPoints(cx, cy, CELL_R)}
                // Alternating depth. Six identical cells read as one flat
                // outline; every other one a shade deeper gives the comb the
                // slight unevenness real wax has, without adding a colour.
                fill={i % 2 === 0 ? play.honey.soft : withAlpha(play.honey.base, 0.3)}
                stroke={play.honey.base}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            ))}
            {/*
              The centre cell is **paper, not marigold.**

              It was marigold, which put a marigold-and-ink bee on a marigold
              ground: her body and the cell behind it were the same value, so
              the thing the whole mark is built around had no silhouette and
              read as a smudge in the middle. Paper gives her an edge to sit
              against, and it also puts the lightest value at the centre, which
              is where the eye goes first. The marigold moves out to the rim,
              where it rings the cell instead of competing with what is in it.
            */}
            <Polygon
              points={hexPoints(100, 100, CELL_R)}
              fill={play.paper}
              stroke={colors.primary.amber}
              strokeWidth={4}
              strokeLinejoin="round"
            />
          </Svg>

          <Bo pose="wave" size={122} animated={active} style={styles.crestBee} />
        </MotiView>

        <MotiView
          animate={{
            opacity: active ? 1 : 0,
            translateY: active || reduced ? 0 : 14,
          }}
          transition={
            reduced ? NO_MOTION : { ...spring.gentle, type: 'spring', delay: 220 }
          }
          style={styles.nameBlock}
        >
          {/* The one place in the app the play voice runs at full size. A name
              is the only thing a 46pt rounded display face should ever set. */}
          <Text variant="playHero" center>
            Hive
          </Text>
          <Doodle
            kind="underline"
            size={124}
            color={play.honey.base}
            style={styles.underline}
          />
        </MotiView>

        <MotiView
          animate={{
            opacity: active ? 1 : 0,
            translateY: active || reduced ? 0 : 12,
          }}
          transition={
            reduced ? NO_MOTION : { ...spring.gentle, type: 'spring', delay: 340 }
          }
        >
          {/* Fraunces italic — the one editorial line a screen is allowed, and
              this screen spends it here. The tagline should sound written
              rather than generated, which is the whole reason that cut exists. */}
          <Text
            variant="editorial"
            color={colors.text.secondary}
            center
            style={styles.tagline}
          >
            {TAGLINE}
          </Text>
        </MotiView>

      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    // Never shrink: the pager lays the pages out in a row, and a flex row will
    // happily compress a child past its stated width.
    flexShrink: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxl,
  },
  block: {
    alignItems: 'center',
  },
  crest: {
    width: CREST_SIZE,
    height: CREST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  /**
   * Bo, centred on the comb.
   *
   * Absolute rather than in flow, so she overlaps the centre cell instead of
   * being laid out under it. Nudged up a little because her drawn mass sits
   * low in her own box — she has legs below the body and only antennae above,
   * so a box centred on the cell puts her *body* below its centre.
   */
  crestBee: {
    position: 'absolute',
    marginTop: -8,
  },
  nameBlock: {
    alignItems: 'center',
  },
  underline: {
    marginTop: -spacing.ms,
  },
  tagline: {
    marginTop: spacing.ms,
    maxWidth: 300,
  },
});

export default BrandSlide;
