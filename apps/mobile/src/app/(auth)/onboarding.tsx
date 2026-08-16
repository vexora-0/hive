import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import Svg, { Polygon } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import {
  colors,
  spacing,
  layout,
  spring,
  duration,
  easing,
  hexPoints,
  useReducedMotion,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text, Button } from '@/components/ui';
import { HiveMark } from '@/components/brand';
import { SafeArea } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { PlayfulBackdrop } from '@/components/decor';
import { BrandSlide } from '@/features/onboarding/components/BrandSlide';
import { OnboardingSlide } from '@/features/onboarding/components/OnboardingSlide';
import { slides } from '@/features/onboarding/data/slides';
import { useOnboardingStore } from '@/features/onboarding/stores/onboardingStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { fetchUserProfile } from '@/features/auth/services/authService';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width and height of one comb cell in the page indicator. */
const DOT_SIZE = 14;

/**
 * How many pages the carousel has.
 *
 * The brand page is page 0 and is not in `slides` — it carries no benefit copy,
 * no vignette and no mascot line, so putting it in that array would mean four
 * required fields nothing on it uses. Every index below is therefore
 * **one-based against `slides`**: feature slide `i` lives at page `i + 1`.
 */
const PAGE_COUNT = 1 + slides.length;

/** How far a swipe has to travel, in px, before it turns the page. */
const SWIPE_THRESHOLD = 60;

/** How fast a flick has to be to turn the page regardless of distance. */
const FLICK_VELOCITY = 400;

/**
 * The page turn, and the dots that track it.
 *
 * **Every number comes out of `theme/motion.ts`.** Moti takes raw
 * `damping`/`stiffness`/`mass` rather than a Reanimated config object, so the
 * fields are spread across by hand — but they are spread, not retyped, and the
 * `reduceMotion` flag those configs carry is replaced by the explicit branch
 * below, since Moti does not read it.
 *
 * A full page of travel is a large panel moving, so it takes `spring.sheet`
 * (ζ 0.87, ~290ms): heavy, arrives once, no wobble. The dots are a selection
 * indicator and take `spring.snappy` (ζ 0.91, ~220ms) — **on width only.** The
 * colour crossfades on a timing curve instead, because a spring driving a
 * colour clamps at 1.0 below ζ 1 and visibly stalls at the end of its run.
 * That is a bug class, not a preference, and it was in here.
 */
const PAGE_TRANSITION = {
  type: 'spring',
  damping: spring.sheet.damping,
  stiffness: spring.sheet.stiffness,
  mass: spring.sheet.mass,
} as const;

const DOT_SCALE_TRANSITION = {
  type: 'spring',
  damping: spring.snappy.damping,
  stiffness: spring.snappy.stiffness,
  mass: spring.snappy.mass,
} as const;

const DOT_FILL_TRANSITION = {
  type: 'timing',
  duration: duration.fast,
  easing: easing.standard,
} as const;

/**
 * What both of the above collapse to when the device asks for less motion.
 *
 * Zero is the absence of an animation, not a duration somebody chose: the page
 * and the dots are simply where they belong.
 */
const STILL = { type: 'timing', duration: 0 } as const;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * The intro carousel.
 *
 * Everything here animates through Moti rather than through Reanimated shared
 * values. That is a deliberate constraint, not a preference: under this
 * project's Reanimated 4 setup — which still registers the deprecated
 * `react-native-reanimated/plugin` — writing a shared value from JavaScript
 * never reaches `useAnimatedStyle`, and `useAnimatedReaction` never runs at
 * all. Both failed silently, which cost a long time to find. Moti drives its
 * own animation loop and works, so the pager, the page indicator and every
 * entrance are built on it.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  // Read from the hook rather than a module-level `Dimensions.get`: that value
  // is captured once at import and is wrong after a rotation or a resize.
  const { width } = useWindowDimensions();
  // Moti drives its own loop and does not read Reanimated's `reduceMotion`
  // flag, so every transition on this screen is branched by hand.
  const reduced = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  // Slides whose entrance has played. The first is in from the start, and a
  // slide is never removed, so swiping back does not replay it.
  const [revealed, setRevealed] = useState<number[]>([0]);
  const [lookupFailed, setLookupFailed] = useState(false);

  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const { user, setProfile, setRole } = useAuthStore();

  const isLastSlide = activeIndex === PAGE_COUNT - 1;

  /** After onboarding: if user is signed in, fetch profile and go to app; else go to login. */
  const navigateAfterOnboarding = useCallback(async () => {
    completeOnboarding();
    if (user?.id) {
      try {
        const result = await fetchUserProfile(user.id);
        if (result) {
          setProfile(result.profile);
          setRole(result.role);
          router.replace(getRoleRoute(result.role) as never);
          return;
        }
      } catch {
        // The lookup failed rather than finding nothing. Falling through to
        // login would send a signed-in user back to a screen they are past,
        // whose own effect retries the same failing call — the loop this
        // screen used to sit in the middle of. Say so and let them retry.
        setLookupFailed(true);
        return;
      }
    }
    router.replace('/(auth)/login' as never);
  }, [completeOnboarding, user?.id, setProfile, setRole, router]);

  // ── Paging ────────────────────────────────────────────────────────────

  /** Turns to a page and marks it seen, so its entrance plays on arrival. */
  const goToPage = useCallback((page: number) => {
    const clamped = Math.min(Math.max(page, 0), PAGE_COUNT - 1);
    setActiveIndex(clamped);
    setRevealed((prev) => (prev.includes(clamped) ? prev : [...prev, clamped]));
  }, []);

  // `.runOnJS(true)` keeps the callback on the JS thread, where it can set
  // React state directly.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > SWIPE_THRESHOLD;
      const fast = Math.abs(event.velocityX) > FLICK_VELOCITY;
      if (!far && !fast) return;
      goToPage(activeIndex + (event.translationX < 0 ? 1 : -1));
    });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    navigateAfterOnboarding();
  }, [navigateAfterOnboarding]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      navigateAfterOnboarding();
      return;
    }
    goToPage(activeIndex + 1);
  }, [isLastSlide, activeIndex, goToPage, navigateAfterOnboarding]);

  // ── UI ────────────────────────────────────────────────────────────────

  // The account exists but we could not load it. Retrying is the only sensible
  // action, and it has to be offered — the previous behaviour was to bounce to
  // login, which retried the same call and bounced back.
  if (lookupFailed) {
    return (
      <SafeArea style={styles.root}>
        <View style={styles.lookupError}>
          <EmptyState
            variant="error"
            title="We couldn't load your account."
            message="Check your connection and try again — your account is fine, we just can't reach it."
            action={{
              label: 'Try again',
              onPress: () => {
                setLookupFailed(false);
                navigateAfterOnboarding();
              },
            }}
          />
        </View>
      </SafeArea>
    );
  }

  return (
    <SafeArea style={styles.root}>
      {/* The weather. `hero` is the full three layers — light, comb and drifting
          pollen — and this is the screen that most earns them: it is the first
          thing anybody sees, it has no photographs of its own to compete with,
          and it used to be a flat cream rectangle. */}
      <PlayfulBackdrop level="hero" />

      {/*
        The name, and the reason it is here.

        The intro carousel ran three slides explaining what the product does
        without once saying what it is called. Somebody who opens the app,
        reads all three and taps through has still never seen the word "Hive" —
        which is a strange thing for a first-run screen to manage. The mark and
        the wordmark sit opposite Skip, on every slide, at a weight that reads
        as a masthead rather than as a logo splash.
      */}
      <View style={styles.header}>
        <View
          style={[styles.brand, activeIndex === 0 && styles.brandHidden]}
          // Hidden from assistive tech too when invisible: the brand page
          // states the name in its heading, and a second silent "Hive" above it
          // is a duplicate announcement.
          accessibilityElementsHidden={activeIndex === 0}
          importantForAccessibility={
            activeIndex === 0 ? 'no-hide-descendants' : 'yes'
          }
        >
          <HiveMark size={28} />
          <Text variant="h4" style={styles.wordmark}>
            Hive
          </Text>
        </View>

        <View style={styles.headerSpacer} />

        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip the introduction"
          style={styles.skip}
        >
          <Text variant="bodySmallBold" color={colors.text.tertiary}>
            Skip
          </Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.pager}>
          {/* Sized explicitly. Left to `flex: 1` the row takes the width of the
              viewport and squashes all three slides into one screen, because a
              flex row shrinks children past their stated width. */}
          <MotiView
            animate={{ translateX: -activeIndex * width }}
            transition={reduced ? STILL : PAGE_TRANSITION}
            style={[styles.row, { width: PAGE_COUNT * width }]}
          >
            <BrandSlide width={width} active={revealed.includes(0)} />

            {slides.map((slide, index) => (
              <OnboardingSlide
                key={slide.id}
                slide={slide}
                width={width}
                active={revealed.includes(index + 1)}
              />
            ))}
          </MotiView>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <View
          style={styles.dotsRow}
          accessibilityRole="progressbar"
          accessibilityLabel={`Slide ${activeIndex + 1} of ${PAGE_COUNT}`}
        >
          {/* Comb cells, not dots.
              The page indicator is three marks a person looks at for a quarter
              of a second, which makes it the cheapest possible place to put the
              brand: the same flat-top cell as the app mark, the tab puck and
              the confetti. The current page is a **filled** cell rather than a
              differently-coloured one — marigold is 2.03:1 on paper and cannot
              be relied on to say which of three you are on, so the signal is
              fill and size, both of which survive at any contrast. */}
          {Array.from({ length: PAGE_COUNT }, (_, index) => (
            <CombDot
              key={index}
              active={index === activeIndex}
              reduced={reduced}
            />
          ))}
        </View>

        <Button variant="primary" size="lg" fullWidth onPress={handleNext}>
          {isLastSlide ? 'Get started' : 'Next'}
        </Button>
      </View>
    </SafeArea>
  );
}

// ---------------------------------------------------------------------------
// Page indicator
// ---------------------------------------------------------------------------

/**
 * One comb cell in the page indicator.
 *
 * Two transforms and one crossfade, split by what each may legally drive:
 * `scale` is a transform and takes `spring.snappy` (ζ 0.91, ~220ms — the app's
 * selection spring, the same one under the tab puck), while the fill is an
 * opacity and takes a timing curve. A spring on the fill would clamp at 1.0
 * below ζ 1 and visibly stall, which is a bug class rather than a preference
 * and was already documented on the pill this replaces.
 */
function CombDot({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <MotiView
      animate={{ scale: active ? 1.3 : 1 }}
      transition={reduced ? STILL : DOT_SCALE_TRANSITION}
      style={styles.dot}
    >
      <Svg width={DOT_SIZE} height={DOT_SIZE} viewBox="0 0 100 100">
        <Polygon
          points={hexPoints(50, 50, 44)}
          fill="none"
          stroke={colors.border.dark}
          strokeWidth={10}
          strokeLinejoin="round"
        />
      </Svg>
      <MotiView
        style={styles.dotFill}
        animate={{ opacity: active ? 1 : 0 }}
        transition={reduced ? STILL : DOT_FILL_TRANSITION}
      >
        <Svg width={DOT_SIZE} height={DOT_SIZE} viewBox="0 0 100 100">
          <Polygon
            points={hexPoints(50, 50, 44)}
            fill={colors.primary.amber}
            stroke={colors.text.accent}
            strokeWidth={8}
            strokeLinejoin="round"
          />
        </Svg>
      </MotiView>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  lookupError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.ms,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.ms,
    // Matches the Skip control's height so the masthead and the escape hatch
    // sit on one line rather than on two that happen to be close.
    minHeight: MIN_TAP_SIZE,
  },
  /**
   * The masthead on the brand page.
   *
   * Invisible, not unmounted — the mark and the name are the hero of that page
   * and printing them twice, 24pt apart, reads as a rendering fault. Keeping
   * the row in the layout stops Skip jumping as the first page turns.
   */
  brandHidden: {
    opacity: 0,
  },
  wordmark: {
    // The name is set in the UI face, not the play face. Fredoka on a mark
    // that appears on every slide would spend the play voice on furniture —
    // it is reserved for the one greeting per screen.
    letterSpacing: 0.2,
  },
  headerSpacer: {
    flex: 1,
  },
  skip: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: 'center',
    paddingHorizontal: spacing.ms,
  },
  pager: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    height: '100%',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
  },
  dotFill: {
    ...StyleSheet.absoluteFillObject,
  },
});
