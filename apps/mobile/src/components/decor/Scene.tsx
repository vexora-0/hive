import React, { useRef } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { play, withAlpha } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What a drawn photograph is a photograph *of*.
 *
 * These are objects and places — **never a child.** That constraint is
 * inherited, not invented here: the onboarding used flat gradients precisely
 * because putting invented children in front of a parent to sell them a privacy
 * product is the wrong trade, and a drawn child would be the same trade with a
 * nicer finish.
 */
export type SceneKind = 'painting' | 'blocks' | 'outdoors' | 'story' | 'snack';

export interface SceneProps {
  /** Which scene. */
  kind: SceneKind;
  /** Width and height of the window it fills, in px. */
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// The register
//
// **No outlines, anywhere in this file.** The first version of these scenes was
// drawn in the mascot's language — 3pt ink strokes around every shape, full
// play-tier chroma — and inside a 70px mount window that read as clipart glued
// onto a photograph. It was louder than the photograph it was standing in for
// and louder than everything around it.
//
// A photograph has no outlines. It has soft edges, a light source and a
// dominant tone. So these are built the way a photograph is: a graded wash for
// the ground, two or three soft shapes at low contrast against it, and a warm
// highlight where the window light falls. Read at size they are unmistakably
// pictures of something. Read closely they are calm.
//
// The one thing kept from the original gradient mounts is that highlight — the
// blown corner a camera leaves in a bright classroom. It is what stops the
// window reading as an illustration in a frame.
// ---------------------------------------------------------------------------

/** How strongly any shape sits against its ground. Deliberately low. */
const SOFT = 0.55;
const SOFTER = 0.38;

interface SceneSpec {
  /** The two ends of the ground wash, top to bottom. */
  ground: [string, string];
  /** The subject, already toned. */
  art: React.ReactNode;
}

const SCENES: Record<SceneKind, SceneSpec> = {
  /** Painting — three colours drifting across warm paper. */
  painting: {
    ground: [play.paper, play.honey.soft],
    art: (
      <G>
        <Path
          d="M8 60 Q34 34 60 56 Q80 72 100 52"
          stroke={play.berry.base}
          strokeOpacity={SOFT}
          strokeWidth={13}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M0 82 Q28 60 54 78 Q76 92 104 74"
          stroke={play.sky.base}
          strokeOpacity={SOFTER}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
        />
        <Ellipse
          cx={72}
          cy={34}
          rx={16}
          ry={13}
          fill={play.grass.base}
          fillOpacity={SOFTER}
        />
      </G>
    ),
  },

  /** Blocks — three soft towers, overlapping, seen close. */
  blocks: {
    ground: [play.sky.soft, play.paper],
    art: (
      <G>
        <Rect
          x={14}
          y={52}
          width={34}
          height={40}
          rx={8}
          fill={play.grass.base}
          fillOpacity={SOFT}
        />
        <Rect
          x={38}
          y={34}
          width={32}
          height={58}
          rx={8}
          fill={play.berry.base}
          fillOpacity={SOFTER}
        />
        <Rect
          x={62}
          y={58}
          width={30}
          height={34}
          rx={8}
          fill={play.honey.base}
          fillOpacity={SOFT}
        />
      </G>
    ),
  },

  /** Outdoors — a low sun over two soft hills. */
  outdoors: {
    ground: [play.sky.soft, play.honey.soft],
    art: (
      <G>
        <Circle cx={70} cy={30} r={15} fill={play.honey.base} fillOpacity={0.6} />
        <Path
          d="M-6 74 Q26 52 58 70 Q82 84 106 66 L106 106 L-6 106 Z"
          fill={play.grass.base}
          fillOpacity={SOFT}
        />
        <Path
          d="M-6 88 Q30 74 62 88 Q84 97 106 86 L106 106 L-6 106 Z"
          fill={play.grass.deep}
          fillOpacity={SOFTER}
        />
      </G>
    ),
  },

  /** Story — a book, open, in soft focus. */
  story: {
    ground: [play.grape.soft, play.paper],
    art: (
      <G>
        <Path
          d="M50 40 Q32 28 10 34 L10 78 Q32 72 50 84 Z"
          fill={play.paper}
          fillOpacity={0.82}
        />
        <Path
          d="M50 40 Q68 28 90 34 L90 78 Q68 72 50 84 Z"
          fill={play.paper}
          fillOpacity={0.66}
        />
        <Path
          d="M50 40 V84"
          stroke={play.grape.deep}
          strokeOpacity={0.22}
          strokeWidth={3}
        />
      </G>
    ),
  },

  /** Snack — fruit and a cup on a warm table. */
  snack: {
    ground: [play.berry.soft, play.paper],
    art: (
      <G>
        <Circle cx={36} cy={58} r={23} fill={play.berry.base} fillOpacity={SOFT} />
        <Ellipse
          cx={48}
          cy={34}
          rx={13}
          ry={7}
          fill={play.grass.base}
          fillOpacity={SOFTER}
          transform="rotate(-18 48 34)"
        />
        <Rect
          x={64}
          y={48}
          width={28}
          height={36}
          rx={7}
          fill={play.sky.base}
          fillOpacity={SOFTER}
        />
      </G>
    ),
  },
};

// ---------------------------------------------------------------------------
// Unique gradient ids
// ---------------------------------------------------------------------------

let instanceCount = 0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Scene>` — a drawn photograph, for the inside of a mount.
 *
 * `preserveAspectRatio="xMidYMid slice"` is what makes one square drawing work
 * in every window the mounts come in: the scene fills the frame and is cropped
 * by it, exactly as a photograph would be, rather than being letterboxed or
 * squashed. Which is why each drawing keeps its subject near the middle and
 * lets the incidental parts — the hills, the brush strokes — run off the edge.
 */
export function Scene({ kind, width, height }: SceneProps) {
  const spec = SCENES[kind];

  const uid = useRef<number | null>(null);
  if (uid.current === null) uid.current = (instanceCount += 1);
  const groundId = `scene-ground-${uid.current}`;
  const lightId = `scene-light-${uid.current}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id={groundId} x1="0" y1="0" x2="0.25" y2="1">
          <Stop offset="0" stopColor={spec.ground[0]} />
          <Stop offset="1" stopColor={spec.ground[1]} />
        </LinearGradient>
        {/* The window light. Warm, from the upper right, falling off to
            nothing by the middle of the frame — the same direction the app's
            `SunGlow` lights every screen, so a photograph and the page it sits
            on are lit from the same place. */}
        <LinearGradient id={lightId} x1="1" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={play.paper} stopOpacity={0.5} />
          <Stop offset="0.55" stopColor={play.paper} stopOpacity={0.08} />
          <Stop offset="1" stopColor={play.paper} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <Rect x={-10} y={-10} width={120} height={120} fill={`url(#${groundId})`} />
      {spec.art}
      <Rect x={-10} y={-10} width={120} height={120} fill={`url(#${lightId})`} />

      {/* The blown corner a camera leaves in a bright classroom. Kept from the
          gradient mounts this replaces — it is the single detail that says
          "photograph" rather than "illustration in a frame". */}
      <Circle cx={74} cy={24} r={19} fill={withAlpha('#FFFFFF', 0.26)} />
    </Svg>
  );
}

export default Scene;
