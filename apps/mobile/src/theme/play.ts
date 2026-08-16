/**
 * Hive Play — the decorative layer
 *
 * `colors.ts` is the *interface* palette: every value in it is measured against
 * paper and licensed to carry text. This file is the *illustration* palette,
 * and it obeys a different rule.
 *
 * ── Why a second palette exists ──────────────────────────────────────
 *
 * The interface palette solved a real problem — five accents at flat chroma,
 * three of which failed AA as text — by pulling everything down to a tier that
 * can be read. That is correct for buttons, labels and status. Applied to
 * *drawings* it is a mistake: a bee drawn in `#9C5A10` and `#2E6B77` is a bee
 * drawn in mud, and a preschool app whose only saturated colour is one button
 * reads as a filing system for adults. Which is what it had become.
 *
 * So: two palettes, one hard boundary.
 *
 * | Palette          | Lives in     | May carry text | Chroma        |
 * |------------------|--------------|----------------|---------------|
 * | `colors.*`       | Interface    | **Yes**        | ≤ C*57 (text) |
 * | `play.*`         | Illustration | **Never**      | C*40–80       |
 *
 * **Nothing in this file may be passed to `<Text color>`, to an icon that
 * conveys meaning, or to a border that separates one control from another.**
 * It exists for fills inside `<Svg>`, for decorative washes behind content, and
 * for confetti. If a colour here ever needs to be read, the answer is the
 * matching value in `colors.text.*`, not a darker version of this one.
 *
 * That boundary is not a convention — `assertDecorative()` at the bottom of
 * this file fails loudly in development if a play colour reaches text.
 *
 * ── The cast ─────────────────────────────────────────────────────────
 *
 * Each play colour is the *saturated sibling* of an interface accent, at the
 * same hue and roughly double the chroma. They are siblings rather than
 * strangers so a drawing in play colours still looks like it belongs beside a
 * marigold button, and the two palettes never fight over what the app is.
 */

import { colors } from './colors';

// ── The play palette ─────────────────────────────────────────────────

/**
 * Illustration fills. **Decorative only** — see the file header.
 *
 * Every entry is a trio so a drawing has depth without a third palette: `base`
 * is the body of a shape, `deep` is its shadow side and its outline, `soft` is
 * the wash it sits on.
 */
export const play = {
  /** Marigold's loud sibling. Bo's body, the sun, the comb. */
  honey: { soft: '#FFEFCE', base: '#FFC24D', deep: '#E08A15' },
  /** Peacock's. Sky, water, the cool half of a gradient. */
  sky: { soft: '#DFF2F6', base: '#6EC2D6', deep: '#2E8AA0' },
  /** Leaf's. Grass, stems, growth. */
  grass: { soft: '#E2F4E4', base: '#7CC886', deep: '#3E8F52' },
  /** Rose's. Hearts, cheeks, balloons. */
  berry: { soft: '#FDE6EC', base: '#F58BA5', deep: '#C2506D' },
  /** Plum's. Dusk, shade, the admin's world. */
  grape: { soft: '#EFE9F9', base: '#AE97DB', deep: '#6F58A3' },
  /** The line every drawing is outlined in — ink, so drawings sit on paper. */
  outline: colors.ink[900],
  /** Paper showing through: highlights, eye whites, the page. */
  paper: '#FFFDF8',
} as const;

export type PlayHue = Exclude<keyof typeof play, 'outline' | 'paper'>;

/** The five hues, in the order a rainbow of them should be drawn. */
export const PLAY_HUES: readonly PlayHue[] = [
  'honey',
  'berry',
  'sky',
  'grass',
  'grape',
];

/**
 * Deterministic play hue for a seed, so the same child gets the same balloon
 * on every screen. Mirrors `identityPalette()` in `colors.ts`, which does the
 * same job for the interface palette — the two are kept in step by using the
 * same hash, so a child whose avatar is rose also gets berry decorations.
 */
export function playHue(seed: string): (typeof play)[PlayHue] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return play[PLAY_HUES[Math.abs(hash) % PLAY_HUES.length]];
}

// ── Drawing constants ────────────────────────────────────────────────

/**
 * The line weight every playful drawing shares, on a 100-unit viewBox.
 *
 * Heavier than the 2.5 the austere spot illustrations use. That difference is
 * the entire visual argument between the two families: a thin even line reads
 * as a diagram, a thick line with round caps reads as something drawn by hand
 * with a fat pen — which is the register a four-year-old's parent should meet.
 */
export const PLAY_STROKE = 4.5;

/** The lighter weight, for interior detail that must not compete with the silhouette. */
export const PLAY_STROKE_FINE = 2.75;

/** Every playful drawing is authored on this grid. */
export const PLAY_VIEW_BOX = '0 0 100 100';

/**
 * Round everywhere, without exception.
 *
 * A single mitred join in a drawing otherwise built from round caps is the
 * fastest way to make it look machine-generated, and it is the detail that
 * survives at 24px when nothing else does.
 */
export const PLAY_LINE = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// ── Honeycomb geometry ───────────────────────────────────────────────
//
// The comb is the app's structural motif — the mark, the tab puck, the
// background texture and the confetti are all the same cell at different
// sizes. It is defined once here so those four never drift apart.

/**
 * Points of a **flat-top** hexagon of circumradius `r` centred on (`cx`, `cy`).
 *
 * Flat-top rather than pointy-top because that is how cells actually tile in a
 * comb, and because the flat edge gives the shape a base to stand on. Matches
 * `HiveMark` exactly; that component predates this file and should be read as
 * the reference implementation.
 */
export function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

/**
 * Column and row pitch for a flat-top comb of circumradius `r`.
 *
 * Flat-top cells tile at 1.5r horizontally and √3·r vertically, with every
 * other column dropped half a row. Getting either figure wrong leaves visible
 * seams in the background texture, which is exactly the sort of thing that
 * reads as "generated" — so it is computed, never eyeballed.
 */
export function combPitch(r: number): { dx: number; dy: number } {
  return { dx: r * 1.5, dy: r * Math.sqrt(3) };
}

// ── The decorative-only guard ────────────────────────────────────────

const PLAY_VALUES = new Set<string>(
  Object.values(play).flatMap((entry) =>
    typeof entry === 'string' ? [entry] : Object.values(entry),
  ),
);

/**
 * True when `value` is a play colour.
 *
 * `Text.tsx` calls this to refuse illustration colours as copy. The interface
 * palette already warns about marigold specifically; this generalises it to
 * the whole decorative layer, so the boundary in this file's header is
 * enforced rather than merely written down.
 */
export function isDecorativeColor(value: string | undefined): boolean {
  return !!value && PLAY_VALUES.has(value);
}
