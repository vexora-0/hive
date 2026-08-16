import React, { useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  Rect,
} from 'react-native-svg';

import {
  play,
  PLAY_STROKE,
  PLAY_STROKE_FINE,
  PLAY_VIEW_BOX,
  PLAY_LINE,
  ambient,
  useReducedMotion,
} from '@/theme';

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/**
 * What Bo is doing.
 *
 * A mascot is a vocabulary, not a sticker. Each pose exists because a specific
 * screen needed to say something an illustration could say better than a
 * sentence, and the set is deliberately closed — a mascot that can do anything
 * ends up doing nothing recognisable.
 *
 *  - `idle` — resting. The default, and the one the app wears most.
 *  - `wave` — hello. Onboarding's first slide, an empty inbox.
 *  - `peek` — watching from behind something. The login form.
 *  - `hide` — eyes covered. **The password field**, and the privacy slide:
 *    Bo not looking is the whole product promise in one drawing.
 *  - `cheer` — arms up. An order placed, an upload finished.
 *  - `sleep` — nothing has happened yet, and that is fine. First-use empties.
 *  - `shrug` — we looked and found nothing. Filtered empties.
 *  - `carry` — holding a print. Orders, the prints slide.
 *  - `point` — look over there. Instructional moments.
 *  - `sad` — something failed. Error states, and **only** error states.
 */
export type BoPose =
  | 'idle'
  | 'wave'
  | 'peek'
  | 'hide'
  | 'cheer'
  | 'sleep'
  | 'shrug'
  | 'carry'
  | 'point'
  | 'sad';

export interface BoProps {
  /** Which pose. @default 'idle' */
  pose?: BoPose;
  /** Width and height in px. Bo is square. @default 120 */
  size?: number;
  /**
   * Mirrors Bo horizontally, so she can face into the content rather than off
   * the edge of the screen. Purely cosmetic — the pose is unchanged.
   */
  flip?: boolean;
  /**
   * Runs the wingbeat and the hover bob. Turn it off for a Bo inside a list
   * row or a scrolling surface, where a permanently moving character is
   * distraction rather than life.
   *
   * **Reduce Motion overrides this to `false`** regardless of what is passed.
   * @default true
   */
  animated?: boolean;
  /**
   * What a screen reader says. Bo is decorative by default and announced only
   * when she is the sole carrier of a meaning — which should be never, because
   * every place she appears also has words.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Anatomy
//
// One blob, on the 100 grid. Everything below is a coordinate on that grid and
// nothing is a magic number: the body is the origin of the whole character, and
// every other part is placed against it.
//
//   body      centre (50, 56), radius 27  → occupies y 29..83
//   face      upper third — eyes 48, cheeks 57, mouth 59
//   stripes   lower third — 68 and 78, clipped to the body
//   wings     behind, springing from the shoulders at (36, 38) and (64, 38)
//   antennae  from the crown at (41, 31) and (59, 31)
//
// The proportions are the cute-signal ones and they are not accidental: head
// large against body, eyes low and wide apart, limbs short. A bee drawn to
// scale is an insect. This one is a toddler.
// ---------------------------------------------------------------------------

const BODY = { cx: 50, cy: 56, r: 27 } as const;

/**
 * No stinger, and that is a decision.
 *
 * Every reference bee has one and it is the single detail that turns a
 * character a three-year-old likes into one they are wary of. Bo is round all
 * the way down.
 */
const LEGS = 'M43 82 L41 90 M57 82 L59 90';

/** Both antennae, each a curve from the crown to a ball. */
const ANTENNAE = 'M41 32 Q35 22 34 16 M59 32 Q65 22 66 16';

// ── Faces ────────────────────────────────────────────────────────────
//
// Eyes and mouth are the pose. Nothing else in the drawing changes as much,
// and nothing else is read as fast — a closed eye and an open one are legible
// at 24px where an arm position is not.

interface Face {
  /** `dot` — open and round. `arc` — closed, curving down (asleep, delighted). */
  eyes: 'dot' | 'arc' | 'arcUp' | 'wide';
  /** The mouth path, on the 100 grid. */
  mouth: string;
  /** Whether the blush shows. Off for sad and shrug: Bo is not enjoying those. */
  blush: boolean;
}

const SMILE = 'M43 59 Q50 66 57 59';
const BIG_SMILE = 'M41 58 Q50 69 59 58';
const FLAT = 'M44 62 H56';
const FROWN = 'M43 64 Q50 58 57 64';
const OPEN = 'M44 59 Q50 68 56 59 Q50 63 44 59';

const FACES: Record<BoPose, Face> = {
  idle: { eyes: 'dot', mouth: SMILE, blush: true },
  wave: { eyes: 'dot', mouth: BIG_SMILE, blush: true },
  peek: { eyes: 'wide', mouth: SMILE, blush: true },
  // Eyes are drawn and then covered by the paws — the drawing is Bo choosing
  // not to look, which only reads if there is something being covered.
  hide: { eyes: 'dot', mouth: SMILE, blush: true },
  cheer: { eyes: 'arc', mouth: OPEN, blush: true },
  sleep: { eyes: 'arc', mouth: FLAT, blush: true },
  shrug: { eyes: 'dot', mouth: FLAT, blush: false },
  carry: { eyes: 'dot', mouth: SMILE, blush: true },
  point: { eyes: 'dot', mouth: SMILE, blush: true },
  sad: { eyes: 'arcUp', mouth: FROWN, blush: false },
};

// ── Arms ─────────────────────────────────────────────────────────────
//
// Two short strokes and, where the pose needs them, two paws. Short because
// long limbs make a blob into a cartoon animal; a stub reads as an arm at any
// size and never looks broken.

interface Arms {
  /** Stroked path for both arms. */
  path: string;
  /** Paw positions, drawn as filled circles at the end of each arm. */
  paws: readonly [number, number][];
}

const ARMS: Record<BoPose, Arms> = {
  idle: { path: 'M25 63 Q19 68 18 73 M75 63 Q81 68 82 73', paws: [[18, 74], [82, 74]] },
  // The raised arm clears the wing.
  //
  // It used to end at (86, 40), which is inside the right wing's ellipse — and
  // although arms are painted over the wings, a marigold-and-ink arm lying
  // along a pale blue wing at the same angle simply disappears into it. Side by
  // side with `idle`, the only difference left was the mouth, which is not what
  // "waving" is supposed to be carried by. It now goes up past the wing's top
  // edge, where the silhouette is unmistakable at any size.
  wave: { path: 'M74 58 Q87 42 88 18 M25 63 Q19 68 18 73', paws: [[89, 15], [18, 74]] },
  peek: { path: 'M27 68 Q21 72 20 77 M73 68 Q79 72 80 77', paws: [[19, 78], [81, 78]] },
  hide: { path: 'M27 62 Q30 52 36 48 M73 62 Q70 52 64 48', paws: [] },
  cheer: { path: 'M26 58 Q17 49 15 39 M74 58 Q83 49 85 39', paws: [[14, 37], [86, 37]] },
  sleep: { path: 'M25 64 Q19 69 18 74 M75 64 Q81 69 82 74', paws: [[18, 75], [82, 75]] },
  shrug: { path: 'M25 60 Q15 58 12 50 M75 60 Q85 58 88 50', paws: [[11, 48], [89, 48]] },
  carry: { path: 'M27 64 Q22 70 24 76 M73 64 Q78 70 76 76', paws: [] },
  point: { path: 'M25 63 Q19 68 18 73 M74 62 Q84 60 92 56', paws: [[18, 74], [93, 55]] },
  sad: { path: 'M25 66 Q20 72 20 78 M75 66 Q80 72 80 78', paws: [[20, 79], [80, 79]] },
};

// ---------------------------------------------------------------------------
// Unique ids
//
// The clip path needs an id, and two Bos on one screen sharing one is a real
// bug on web — the second instance clips against the first's geometry, which
// on a mounted-and-unmounted first instance means it clips against nothing and
// the stripes escape the body. A module counter is enough and, unlike
// `useId()`, produces something that is legal inside `url(#…)` on every
// platform: React's generated ids contain colons.
// ---------------------------------------------------------------------------

let instanceCount = 0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Bo>` — the Hive bee, the app's guide.
 *
 * Hive's mark is a comb cell and its product is a room full of small people
 * being looked after; the bee was already implied by both and had simply never
 * been drawn. Bo exists so that the app has somebody in it — she introduces the
 * product, she covers her eyes at the password field, she is asleep on a screen
 * where nothing has happened yet, and she cheers when a print is ordered.
 *
 * **She is drawn in three layers rather than one `<Svg>`**, because the wings
 * have to move independently and Moti animates views, not SVG nodes. Wings sit
 * behind on two absolutely-positioned canvases, the body paints over them in
 * normal flow, and pose props paint last. That layering is also why the wingbeat
 * costs nothing: it is a transform on a static picture, never a re-render.
 *
 * ```tsx
 * <Bo pose="wave" size={140} />
 * <Bo pose="hide" size={96} animated={false} />
 * ```
 */
export function Bo({
  pose = 'idle',
  size = 120,
  flip = false,
  animated = true,
  accessibilityLabel,
  style,
}: BoProps) {
  const reduced = useReducedMotion();
  const moving = animated && !reduced;

  const clipId = useRef<string | null>(null);
  if (!clipId.current) clipId.current = `bo-body-${(instanceCount += 1)}`;
  const bodyClip = clipId.current;

  const face = FACES[pose];
  const arms = ARMS[pose];

  // A sleeping bee does not beat its wings, and a sleeping bee whose wings are
  // beating is the sort of detail that quietly tells a child the drawing was
  // not thought about.
  const wingsBeat = moving && pose !== 'sleep';

  const box = useMemo<ViewStyle>(
    () => ({
      width: size,
      height: size,
      transform: flip ? [{ scaleX: -1 }] : undefined,
    }),
    [size, flip],
  );

  return (
    <View
      style={[box, style]}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={
        accessibilityLabel ? 'yes' : 'no-hide-descendants'
      }
    >
      {/* The hover. Everything inside rises and falls together, so the wings
          keep their relationship to the body while the whole character floats.
          `spring.alive` is not used here — a bob is a cycle, not an arrival,
          and it wants a symmetrical curve rather than a settle. */}
      <MotiView
        style={styles.layer}
        from={{ translateY: moving ? -3 : 0 }}
        animate={{ translateY: moving ? 3 : 0 }}
        transition={
          moving
            ? {
                type: 'timing',
                duration: ambient.bob,
                loop: true,
                repeatReverse: true,
              }
            : { type: 'timing', duration: 0 }
        }
      >
        <Wing side="left" beating={wingsBeat} size={size} />
        <Wing side="right" beating={wingsBeat} size={size} />

        <Svg width={size} height={size} viewBox={PLAY_VIEW_BOX}>
          <Defs>
            <ClipPath id={bodyClip}>
              <Circle cx={BODY.cx} cy={BODY.cy} r={BODY.r} />
            </ClipPath>
          </Defs>

          {/* ── Behind the body: antennae, legs, arms ── */}
          <G
            fill="none"
            stroke={play.outline}
            strokeWidth={PLAY_STROKE}
            {...PLAY_LINE}
          >
            <Path d={ANTENNAE} />
            <Path d={LEGS} />
            <Path d={arms.path} />
          </G>
          <G fill={play.outline}>
            <Circle cx={34} cy={14} r={4} />
            <Circle cx={66} cy={14} r={4} />
            {arms.paws.map(([x, y]) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r={5} />
            ))}
          </G>

          {/* ── The body ── */}
          <Circle
            cx={BODY.cx}
            cy={BODY.cy}
            r={BODY.r}
            fill={play.honey.base}
            stroke={play.outline}
            strokeWidth={PLAY_STROKE}
          />

          {/* Stripes are clipped rather than trimmed to fit. A hand-shortened
              band drifts the moment the body radius changes; a clip cannot. */}
          <G clipPath={`url(#${bodyClip})`}>
            <Rect x={18} y={66} width={64} height={7} fill={play.outline} />
            <Rect x={18} y={77} width={64} height={6} fill={play.outline} />
          </G>

          {/* The outline is redrawn over the stripes so the silhouette stays
              unbroken — a clipped fill butts against the stroke's inner edge
              and leaves a visible notch at the two points where a band meets
              the curve. */}
          <Circle
            cx={BODY.cx}
            cy={BODY.cy}
            r={BODY.r}
            fill="none"
            stroke={play.outline}
            strokeWidth={PLAY_STROKE}
          />

          <FaceMarks face={face} />
          <PoseProps pose={pose} />
        </Svg>
      </MotiView>

      <Sparkles active={moving && pose === 'cheer'} size={size} />
      <Zzz active={moving && pose === 'sleep'} size={size} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------

function FaceMarks({ face }: { face: Face }) {
  return (
    <G>
      {face.blush && (
        <G fill={play.berry.base} opacity={0.5}>
          <Ellipse cx={30} cy={57} rx={6} ry={4} />
          <Ellipse cx={70} cy={57} rx={6} ry={4} />
        </G>
      )}

      {face.eyes === 'dot' || face.eyes === 'wide' ? (
        <G fill={play.outline}>
          <Circle cx={41} cy={48} r={face.eyes === 'wide' ? 5.4 : 4.4} />
          <Circle cx={59} cy={48} r={face.eyes === 'wide' ? 5.4 : 4.4} />
          {/* The catchlight. One dot, up and to the left on both eyes — a
              highlight that follows each eye's own centre reads as a squint. */}
          <G fill={play.paper}>
            <Circle cx={42.6} cy={46.3} r={1.7} />
            <Circle cx={60.6} cy={46.3} r={1.7} />
          </G>
        </G>
      ) : (
        <G
          fill="none"
          stroke={play.outline}
          strokeWidth={PLAY_STROKE}
          {...PLAY_LINE}
        >
          {face.eyes === 'arc' ? (
            <>
              <Path d="M36 48 Q41 43 46 48" />
              <Path d="M54 48 Q59 43 64 48" />
            </>
          ) : (
            // arcUp — the corners fall. Two curves, and Bo is unhappy; it is
            // the cheapest and most reliable emotion in the whole drawing.
            <>
              <Path d="M36 45 Q41 50 46 45" />
              <Path d="M54 45 Q59 50 64 45" />
            </>
          )}
        </G>
      )}

      <Path
        d={face.mouth}
        fill="none"
        stroke={play.outline}
        strokeWidth={PLAY_STROKE_FINE}
        {...PLAY_LINE}
      />
    </G>
  );
}

// ---------------------------------------------------------------------------
// Pose props
// ---------------------------------------------------------------------------

/** The things Bo holds or hides behind, drawn over the body. */
function PoseProps({ pose }: { pose: BoPose }) {
  if (pose === 'hide') {
    // Two paws over the eyes. Drawn *after* the face so the eyes exist and are
    // then covered — the meaning is Bo declining to look, and a Bo drawn
    // without eyes underneath is just a bee with mittens.
    return (
      <G fill={play.honey.deep} stroke={play.outline} strokeWidth={PLAY_STROKE}>
        <Ellipse cx={39} cy={48} rx={11} ry={9} />
        <Ellipse cx={61} cy={48} rx={11} ry={9} />
      </G>
    );
  }

  if (pose === 'carry') {
    // A print, held out in front: paper, a photograph, and the deep foot every
    // mount in this app has. The same asymmetric margin as `PhotoMount` and
    // `EmptyAlbum`, at toy scale.
    return (
      <G>
        <Rect
          x={31}
          y={58}
          width={38}
          height={34}
          rx={2}
          fill={play.paper}
          stroke={play.outline}
          strokeWidth={PLAY_STROKE}
        />
        <Rect x={36} y={63} width={28} height={19} fill={play.sky.soft} />
        <Path
          d="M36 82 L45 71 L52 78 L57 74 L64 82 Z"
          fill={play.grass.base}
        />
        <Circle cx={57} cy={68} r={3} fill={play.honey.base} />
      </G>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Wings
// ---------------------------------------------------------------------------

/**
 * One wing, on its own canvas so it can move without the body.
 *
 * It rotates about the **shoulder**, not about the centre of the box. That is
 * the entire difference between a wing beating and a wing sliding: `transformOrigin`
 * is given in percentages of the layer, and the shoulder sits at (36, 38) on
 * the 100 grid, so 36% / 38%.
 *
 * The beat is 260ms per half-cycle, which is slow for a real bee by two orders
 * of magnitude and correct here — the drawing has to read as *flapping*, and
 * anything faster than about 4Hz on a 60Hz display reads as flicker.
 */
function Wing({
  side,
  beating,
  size,
}: {
  side: 'left' | 'right';
  beating: boolean;
  size: number;
}) {
  const left = side === 'left';
  const origin: ViewStyle = {
    transformOrigin: left ? '36% 38%' : '64% 38%',
  };
  // **Both ends of the sweep splay outward.**
  //
  // It used to run from +10° to -16° on the left wing, and the positive end of
  // that is the problem: rotating the left wing clockwise about the shoulder
  // swings it *inward*, so at one extreme of every beat the two wings converged
  // over Bo's head into a single blob. A resting frame that looks broken is
  // still a frame somebody sees, and it is the one they see whenever the
  // animation has not started yet.
  //
  // The sweep now sits entirely on the outward side of neutral: a small splay
  // to a large one, which reads as a wingbeat and has no bad frame in it.
  const from = left ? '-3deg' : '3deg';
  const to = left ? '-21deg' : '21deg';

  return (
    <MotiView
      style={[styles.layer, origin]}
      from={{ rotate: beating ? from : '0deg' }}
      animate={{ rotate: beating ? to : '0deg' }}
      transition={
        beating
          ? {
              type: 'timing',
              duration: ambient.wing,
              loop: true,
              repeatReverse: true,
            }
          : { type: 'timing', duration: 0 }
      }
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox={PLAY_VIEW_BOX}>
        <G
          fill={play.sky.soft}
          fillOpacity={0.85}
          stroke={play.outline}
          strokeWidth={PLAY_STROKE_FINE}
        >
          {left ? (
            <Ellipse
              cx={24}
              cy={30}
              rx={17}
              ry={11}
              transform="rotate(-28 24 30)"
            />
          ) : (
            <Ellipse
              cx={76}
              cy={30}
              rx={17}
              ry={11}
              transform="rotate(28 76 30)"
            />
          )}
        </G>
      </Svg>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Ambient extras
// ---------------------------------------------------------------------------

/** Four-pointed stars that pop around a cheering Bo. */
function Sparkles({ active, size }: { active: boolean; size: number }) {
  if (!active) return null;

  const stars: readonly [number, number, number, number][] = [
    [12, 22, 7, 0],
    [88, 26, 5.5, 220],
    [20, 74, 5, 440],
    [84, 70, 6.5, 660],
  ];

  return (
    <View style={styles.layer} pointerEvents="none">
      {stars.map(([x, y, r, delay]) => (
        <MotiView
          key={`${x}-${y}`}
          style={StyleSheet.absoluteFill}
          // Scale only. A sparkle that has to animate to become visible is a
          // sparkle that is missing whenever the animation does not run, and
          // this whole file is careful never to hide anything behind motion.
          from={{ scale: 0.45 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'timing',
            duration: ambient.twinkle,
            delay,
            loop: true,
            repeatReverse: true,
          }}
        >
          <Svg width={size} height={size} viewBox={PLAY_VIEW_BOX}>
            <Path
              d={starPath(x, y, r)}
              fill={play.honey.base}
              stroke={play.honey.deep}
              strokeWidth={1.2}
            />
          </Svg>
        </MotiView>
      ))}
    </View>
  );
}

/**
 * A four-pointed sparkle: a square with each edge pulled into the centre.
 *
 * Not a five-pointed star. The pinched-diamond form is the one that still reads
 * as *sparkle* rather than as *rating* at 6px, and it is the shape the rest of
 * the doodle kit uses, so the two families match.
 */
function starPath(cx: number, cy: number, r: number): string {
  const w = r * 0.34;
  return [
    `M${cx} ${cy - r}`,
    `Q${cx + w} ${cy - w} ${cx + r} ${cy}`,
    `Q${cx + w} ${cy + w} ${cx} ${cy + r}`,
    `Q${cx - w} ${cy + w} ${cx - r} ${cy}`,
    `Q${cx - w} ${cy - w} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
}

/** Three z's rising off a sleeping Bo, each a little later and a little higher. */
function Zzz({ active, size }: { active: boolean; size: number }) {
  if (!active) return null;

  const zs: readonly [number, number, number, number][] = [
    [74, 30, 7, 0],
    [84, 20, 9, 700],
    [94, 8, 11, 1400],
  ];

  return (
    <View style={styles.layer} pointerEvents="none">
      {zs.map(([x, y, s, delay]) => (
        <MotiView
          key={delay}
          style={StyleSheet.absoluteFill}
          // Drift only — a `z` rising off a sleeping bee reads as a `z`
          // whether or not it happens to be moving.
          from={{ translateY: 7 }}
          animate={{ translateY: -5 }}
          transition={{
            type: 'timing',
            duration: 2100,
            delay,
            loop: true,
            repeatReverse: true,
          }}
        >
          <Svg width={size} height={size} viewBox={PLAY_VIEW_BOX}>
            {/* Drawn twice: a thick paper casing, then the letter on top.
                The z's rise past the right wing, and a 2.6pt plum stroke laid
                over a pale blue wing at the same weight as the wing's own
                outline reads as a scribble rather than as a letter. The casing
                cuts a hole in whatever is behind and costs one extra path. */}
            <Path
              d={`M${x} ${y} h${s} l-${s} ${s} h${s}`}
              fill="none"
              stroke={play.paper}
              strokeWidth={6}
              {...PLAY_LINE}
            />
            <Path
              d={`M${x} ${y} h${s} l-${s} ${s} h${s}`}
              fill="none"
              stroke={play.grape.deep}
              strokeWidth={2.6}
              {...PLAY_LINE}
            />
          </Svg>
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default Bo;
