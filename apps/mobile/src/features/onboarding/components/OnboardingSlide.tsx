import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui';
import { HoneycombPattern } from '@/components/animation';
import { SlideVignette } from './SlideVignette';
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

/** How long each line waits behind the one before it, in ms. */
const LINE_STEP = 70;

/** How far an arriving line travels, in px. */
const LINE_RISE = 22;

// ---------------------------------------------------------------------------
// One line of copy
// ---------------------------------------------------------------------------

function Line({
  active,
  order,
  style,
  children,
}: {
  active: boolean;
  order: number;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <MotiView
      animate={{
        opacity: active ? 1 : 0,
        translateY: active ? 0 : LINE_RISE,
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 180,
        mass: 1,
        // Behind the vignette, so the picture lands before its caption.
        delay: active ? 300 + order * LINE_STEP : 0,
      }}
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
        <Line active={active} order={0} style={styles.eyebrow}>
          <Text variant="eyebrow" color={colors.text.tertiary}>
            {slide.eyebrow}
          </Text>
        </Line>

        <Line active={active} order={1} style={styles.title}>
          <Text variant="h1">{slide.title}</Text>
        </Line>

        <Line active={active} order={2}>
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
