import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';

import {
  colors,
  spacing,
  layout,
  spring,
  travel,
  STAGGER_STEP,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui';
import { HoneycombPattern } from '@/components/animation';
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
      {/* Clipped so the comb's negative offset cannot widen the pager. */}
      <View pointerEvents="none" style={styles.combLayer}>
        <View style={styles.combInner}>
          <HoneycombPattern rows={4} cols={4} size={34} />
        </View>
      </View>

      <View style={styles.stage}>
        <SlideVignette kind={slide.vignette} active={active} width={stageWidth} />
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

        <Line active={active} order={1} reduced={reduced} style={styles.title}>
          <Text variant="h1">{slide.title}</Text>
        </Line>

        <Line active={active} order={2} reduced={reduced}>
          <Text variant="body" muted>
            {slide.description}
          </Text>
        </Line>
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
    backgroundColor: colors.background.cream,
  },
  combLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  combInner: {
    position: 'absolute',
    top: '4%',
    right: -46,
    opacity: 0.5,
  },
  stage: {
    marginBottom: spacing.xl,
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
});

export default OnboardingSlide;
