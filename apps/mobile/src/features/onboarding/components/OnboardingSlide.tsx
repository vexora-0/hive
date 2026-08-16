import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';

import {
  colors,
  play,
  spacing,
  layout,
  spring,
  travel,
  STAGGER_STEP,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui';
import { Bo, SpeechBubble } from '@/components/mascot';
import { Doodle } from '@/components/decor';
import { SlideVignette, VIGNETTE_SETTLED_AT, NO_MOTION } from './SlideVignette';
import type { OnboardingSlideData } from '@/features/onboarding/data/slides';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingSlideProps {
  /** Slide copy and which vignette to draw. */
  slide: OnboardingSlideData;
  /** Width of one page. */
  width: number;
  /**
   * True once this slide has come into view, and true from then on. Drives the
   * entrance.
   */
  active: boolean;
}

/**
 * How long each line waits behind the one before it, and how far it travels.
 *
 * Both come from the theme. `STAGGER_STEP` is the app's one stagger interval —
 * the feed uses it, every `<Reveal>` uses it — so the intro carousel arriving
 * on the same beat as the screens behind it is not a coincidence worth
 * re-deciding here.
 */
const LINE_STEP = STAGGER_STEP;
const LINE_RISE = travel.rise;

/** How tall Bo stands on a slide. Also her width — she is square. */
const BO_SIZE = 118;

// ---------------------------------------------------------------------------
// One line of copy
// ---------------------------------------------------------------------------

/**
 * One line of the caption, rising in behind the picture.
 *
 * **This is not a second staggered group.** The vignette and the copy are one
 * choreography with one clock: the pieces of the illustration assemble first,
 * and the lines start at {@link VIGNETTE_SETTLED_AT}, which is the vignette's
 * own published finishing delay rather than a number guessed to look about
 * right. Change the illustration's timing and the caption follows it.
 */
function Line({
  active,
  order,
  reduced,
  style,
  children,
}: {
  active: boolean;
  order: number;
  reduced: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <MotiView
      animate={{
        opacity: active ? 1 : 0,
        translateY: active ? 0 : LINE_RISE,
      }}
      transition={
        reduced
          ? NO_MOTION
          : {
              type: 'spring',
              damping: spring.gentle.damping,
              stiffness: spring.gentle.stiffness,
              mass: spring.gentle.mass,
              delay: active ? VIGNETTE_SETTLED_AT + order * LINE_STEP : 0,
            }
      }
      style={style}
    >
      {children}
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OnboardingSlide>` — one page of the intro carousel.
 *
 * The illustration and the copy assemble in turn when the slide arrives: the
 * photo mounts drop into place one after another, then the eyebrow, headline
 * and body rise in behind them. It is the same staggered entrance the login
 * screen uses, so the two screens either side of the front door move alike.
 */
export function OnboardingSlide({ slide, width, active }: OnboardingSlideProps) {
  const stageWidth = width - layout.screenPaddingHorizontal * 2;
  // Moti runs its own animation loop and does not read Reanimated's
  // `reduceMotion` flag, so it has to be branched by hand.
  const reduced = useReducedMotion();

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.stage}>
        <SlideVignette kind={slide.vignette} active={active} width={stageWidth} />

        {/* Bo stands at the foot of the picture and overlaps it. The overlap is
            the point: a mascot placed in her own clear band beside the
            illustration is a sticker in a slot, and one that breaks the
            picture's edge is a character standing in front of it. */}
        <MotiView
          // Placed by `left` off the stage width we were handed, rather than by
          // `right: 0` off whatever the stage measures out to. Both put her in
          // the same place today; this one cannot move if the vignette's
          // intrinsic width ever stops matching the padded content box.
          style={[styles.bo, { left: stageWidth - BO_SIZE }]}
          animate={{
            opacity: active ? 1 : 0,
            scale: active ? 1 : 0.7,
            translateY: active ? 0 : 20,
          }}
          transition={
            reduced
              ? NO_MOTION
              : {
                  ...spring.alive,
                  type: 'spring',
                  delay: active ? VIGNETTE_SETTLED_AT : 0,
                }
          }
        >
          <Bo pose={slide.pose} size={BO_SIZE} animated={active} />
        </MotiView>

        {/* The dotted trail she flew in on. Behind everything, low contrast,
            and pointing from the top-left toward where she landed. */}
        <Doodle
          kind="flightPath"
          size={130}
          color={play.honey.deep}
          opacity={0.3}
          rotate={-6}
          style={styles.trail}
        />
      </View>

      <View style={styles.copy}>
        {/* Sentence case, not a spaced capital eyebrow. These three strings —
            "What you get", "Who can see", "If you want it" — are the halves of
            spoken sentences, and set in caps they read as a system shouting
            headings at somebody who has not yet signed in. */}
        <Line active={active} order={0} reduced={reduced} style={styles.eyebrow}>
          <Text variant="label" color={colors.text.secondary}>
            {slide.eyebrow}
          </Text>
        </Line>

        {/* The play voice, and one of the four places in the whole app it is
            allowed. Onboarding is a greeting — the one moment where the product
            is introducing itself rather than getting out of the way — and
            Fraunces, which is right for a caption under a photograph, was
            reading as a brochure here. */}
        <Line active={active} order={1} reduced={reduced} style={styles.title}>
          <Text variant="playTitle">{slide.title}</Text>
          <Doodle
            kind="underline"
            size={116}
            color={play.honey.base}
            style={styles.underline}
          />
        </Line>

        <Line active={active} order={2} reduced={reduced}>
          <Text variant="body" muted>
            {slide.description}
          </Text>
        </Line>

        {active && (
          <SpeechBubble
            tail="top"
            tailAt={0.16}
            // Last in the sequence: picture, then heading, then body, then Bo
            // speaks. She has the final word on every slide, which is what
            // makes her feel like the guide rather than the decoration.
            delay={VIGNETTE_SETTLED_AT + 3 * LINE_STEP + 120}
            style={styles.bubble}
          >
            {slide.says}
          </SpeechBubble>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    // Never shrink: the pager lays the slides out in a row, and a flex row
    // will happily compress a child past its stated width.
    flexShrink: 0,
    // The height comes from stretching inside the row. It used to be measured
    // by the parent and passed back down as a prop, which was a feedback loop:
    // the measurement changed the children, the children changed the layout,
    // the layout re-fired the measurement. The screen re-rendered continuously
    // and every entrance restarted before it could finish.
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    // Lifts the centred block clear of the page dots below it, which the
    // description was otherwise sitting right on top of.
    paddingBottom: spacing.xl,
    // No background. The screen behind now paints the light, the comb and the
    // pollen — see `<PlayfulBackdrop>` in the onboarding screen — and a slide
    // filling itself with flat cream would paint over all three.
  },
  stage: {
    marginBottom: spacing.xl,
    // The mascot and the trail are positioned against this box, so it has to
    // be a positioning context. Overflow stays visible: Bo deliberately hangs
    // below the vignette's bottom edge.
    position: 'relative',
  },
  /**
   * Bo's corner.
   *
   * She hangs below the vignette's bottom edge — the overlap is what makes her
   * read as standing in front of the picture rather than beside it — but she
   * stays **inside** the right margin. She was at `right: -10` and the last
   * 30px of her was off the edge of a 430pt screen, which is the difference
   * between a mascot peeking and a mascot that looks like a rendering fault.
   */
  bo: {
    position: 'absolute',
    bottom: -30,
  },
  trail: {
    position: 'absolute',
    left: -18,
    top: -22,
    zIndex: -1,
  },
  copy: {
    maxWidth: 360,
  },
  eyebrow: {
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.ms,
  },
  /** Pulled up under the headline's baseline, and inset so it starts under the
      first word rather than at the margin — a rule that begins exactly at the
      text edge reads as a border. */
  underline: {
    marginTop: -spacing.xs,
    marginLeft: spacing.xs,
  },
  bubble: {
    marginTop: spacing.md,
  },
});

export default OnboardingSlide;
