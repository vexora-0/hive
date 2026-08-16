import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { play, PLAY_LINE } from '@/theme';

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

/**
 * One decorative mark.
 *
 * These are the app's marginalia — the things drawn *around* content rather
 * than as content. A squiggle under a greeting, a dotted path a bee flies
 * along, a rainbow behind an empty state. Nothing here ever carries meaning; a
 * doodle deleted must cost the screen nothing but charm.
 *
 * Every one is a single open path on its own viewBox, stroked and never
 * filled, so any of them can be tinted to any colour by the caller and all of
 * them look like they came out of the same pen.
 */
export type DoodleKind =
  | 'sparkle'
  | 'burst'
  | 'squiggle'
  | 'underline'
  | 'flightPath'
  | 'cloud'
  | 'sun'
  | 'heart'
  | 'arrow'
  | 'rainbow'
  | 'scallop'
  | 'confettiBit';

interface DoodleSpec {
  /** `w h` of the mark's own grid — most are not square. */
  box: string;
  /** The path, or paths, drawn on that grid. */
  d: string;
  /** Stroke weight on that grid. Tuned per mark, not shared. */
  weight: number;
  /** Marks that read better closed and filled — the heart, the confetti chip. */
  fill?: boolean;
  /** The mark's natural aspect ratio, so a caller only has to give a width. */
  ratio: number;
}

/**
 * The whole vocabulary, and no runtime generation.
 *
 * Doodles are hand-authored coordinates rather than parametric shapes on
 * purpose: a squiggle produced by a sine function is even, and an even squiggle
 * is a waveform. The small irregularities below — the second hump of the
 * squiggle being shallower than the first, the underline overshooting its start
 * — are what the eye reads as *drawn*, and they are the entire reason this file
 * is a table of strings instead of ten lines of trigonometry.
 */
const DOODLES: Record<DoodleKind, DoodleSpec> = {
  /** A four-pointed twinkle. The app's most-used mark. */
  sparkle: {
    box: '0 0 40 40',
    d: 'M20 3 Q23 17 37 20 Q23 23 20 37 Q17 23 3 20 Q17 17 20 3 Z',
    weight: 2.4,
    fill: true,
    ratio: 1,
  },
  /** Six short rays — excitement, without a shape in the middle. */
  burst: {
    box: '0 0 40 40',
    d:
      'M20 2 V11 M20 29 V38 M2 20 H11 M29 20 H38 ' +
      'M7 7 L13 13 M27 27 L33 33 M33 7 L27 13 M13 27 L7 33',
    weight: 3,
    ratio: 1,
  },
  /** Three humps, uneven. Sits under a heading or between two sections. */
  squiggle: {
    box: '0 0 120 20',
    d: 'M4 14 Q16 2 28 12 Q40 22 54 9 Q68 -2 82 12 Q94 23 116 8',
    weight: 4,
    ratio: 6,
  },
  /**
   * The two-stroke underline. Draws under a word and past both ends of it,
   * because a rule that stops exactly at the last letter is a border.
   */
  underline: {
    box: '0 0 120 22',
    d: 'M3 8 Q40 18 117 6 M9 17 Q46 24 108 14',
    weight: 3.6,
    ratio: 5.45,
  },
  /** The dotted line a bee leaves behind. */
  flightPath: {
    box: '0 0 140 60',
    d: 'M4 50 Q30 4 68 30 Q104 54 136 10',
    weight: 3.4,
    ratio: 2.33,
  },
  cloud: {
    box: '0 0 90 50',
    d:
      'M18 42 Q2 42 4 30 Q6 20 18 21 Q20 6 36 7 Q50 8 53 20 ' +
      'Q68 14 76 24 Q88 30 80 42 Z',
    weight: 3.4,
    ratio: 1.8,
  },
  /** A sun that is mostly rays — the disc is small so it never looks like a dot. */
  sun: {
    box: '0 0 60 60',
    d:
      'M30 14 A16 16 0 1 1 29.9 14 ' +
      'M30 2 V7 M30 53 V58 M2 30 H7 M53 30 H58 ' +
      'M10 10 L14 14 M46 46 L50 50 M50 10 L46 14 M14 46 L10 50',
    weight: 3.2,
    ratio: 1,
  },
  heart: {
    box: '0 0 40 36',
    d: 'M20 33 Q2 20 2 12 Q2 3 11 3 Q18 3 20 10 Q22 3 29 3 Q38 3 38 12 Q38 20 20 33 Z',
    weight: 2.6,
    fill: true,
    ratio: 1.11,
  },
  /** A curved arrow that points where a straight one would be an instruction. */
  arrow: {
    box: '0 0 80 60',
    d: 'M6 8 Q42 4 62 44 M62 44 L48 36 M62 44 L68 28',
    weight: 3.6,
    ratio: 1.33,
  },
  /** Three arcs. Not seven — a seven-band rainbow is a flag, three is a doodle. */
  rainbow: {
    box: '0 0 120 64',
    d:
      'M6 60 A54 54 0 0 1 114 60 ' +
      'M20 60 A40 40 0 0 1 100 60 ' +
      'M34 60 A26 26 0 0 1 86 60',
    weight: 4.5,
    ratio: 1.875,
  },
  /** A wavy edge, for the bottom of a panel that should not end in a straight line. */
  scallop: {
    box: '0 0 120 16',
    d: 'M0 4 Q10 16 20 4 Q30 16 40 4 Q50 16 60 4 Q70 16 80 4 Q90 16 100 4 Q110 16 120 4',
    weight: 3,
    ratio: 7.5,
  },
  /** One chip of confetti — a rounded lozenge, drawn at a tilt. */
  confettiBit: {
    box: '0 0 20 30',
    d: 'M10 3 Q17 3 17 12 Q17 27 10 27 Q3 27 3 12 Q3 3 10 3 Z',
    weight: 2,
    fill: true,
    ratio: 0.67,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoodleProps {
  /** Which mark. */
  kind: DoodleKind;
  /** Width in px. Height follows the mark's own ratio. @default 48 */
  size?: number;
  /** Stroke colour. @default marigold's deep tone */
  color?: string;
  /**
   * Fill colour for the closed marks — heart, sparkle, confetti chip. Ignored
   * by the open ones. Defaults to a lighter tint of `color` is *not* possible
   * without colour maths, so it is explicit: pass one, or get an outline.
   */
  fill?: string;
  /** 0–1. Doodles usually want to sit back. @default 1 */
  opacity?: number;
  /** Degrees. Doodles are more convincing off-axis than square to the screen. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Doodle>` — one decorative mark from the kit.
 *
 * The kit exists so that decoration is a *choice from a set* rather than an
 * improvisation. Twelve marks, one pen, one place they are defined. A screen
 * that wants a flourish reaches in here; it does not draw its own SVG, and it
 * certainly does not reach for an emoji — an emoji renders as a different
 * picture on every platform and in a colour palette nobody in this project
 * chose.
 *
 * ```tsx
 * <Doodle kind="squiggle" size={110} color={play.honey.deep} />
 * <Doodle kind="sparkle" size={22} fill={play.honey.base} rotate={-12} />
 * ```
 */
export function Doodle({
  kind,
  size = 48,
  color = play.honey.deep,
  fill,
  opacity = 1,
  rotate,
  style,
}: DoodleProps) {
  const spec = DOODLES[kind];
  const height = size / spec.ratio;

  return (
    <View
      style={[
        { width: size, height, opacity },
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style,
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={height} viewBox={spec.box}>
        <G
          fill={spec.fill ? fill ?? 'none' : 'none'}
          stroke={color}
          strokeWidth={spec.weight}
          {...PLAY_LINE}
        >
          <Path d={spec.d} />
        </G>
      </Svg>
    </View>
  );
}

/** Natural height of a doodle at a given width — for laying one out by hand. */
export function doodleHeight(kind: DoodleKind, size: number): number {
  return size / DOODLES[kind].ratio;
}

export default Doodle;
