import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import {
  colors,
  spacing,
  radius,
  layout,
  spring,
  duration,
  easing,
  useReducedMotion,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text, Button } from '@/components/ui';
import { SafeArea } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { OnboardingSlide } from '@/features/onboarding/components/OnboardingSlide';
import { slides } from '@/features/onboarding/data/slides';
import { useOnboardingStore } from '@/features/onboarding/stores/onboardingStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { fetchUserProfile } from '@/features/auth/services/authService';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_SIZE = 7;
const DOT_ACTIVE_WIDTH = 28;

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

const DOT_TRANSITION = {
  width: {
    type: 'spring',
    damping: spring.snappy.damping,
    stiffness: spring.snappy.stiffness,
    mass: spring.snappy.mass,
  },
  backgroundColor: {
    type: 'timing',
    duration: duration.fast,
    easing: easing.standard,
  },
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

  const isLastSlide = activeIndex === slides.length - 1;

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
    const clamped = Math.min(Math.max(page, 0), slides.length - 1);
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
      {/* Skip — quiet, but always reachable. */}
      <View style={styles.header}>
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
            style={[styles.row, { width: slides.length * width }]}
          >
            {slides.map((slide, index) => (
              <OnboardingSlide
                key={slide.id}
                slide={slide}
                width={width}
                active={revealed.includes(index)}
              />
            ))}
          </MotiView>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <View
          style={styles.dotsRow}
          accessibilityRole="progressbar"
          accessibilityLabel={`Slide ${activeIndex + 1} of ${slides.length}`}
        >
          {/* The current page is drawn in the **readable** marigold. `#F0A03A`
              is 2.03:1 on paper: as the mark saying which of three pages you
              are on, it has to be read, and at that ratio it simply is not.
              `text.accent` is 5.12:1 and still unmistakably marigold. */}
          {slides.map((slide, index) => (
            <MotiView
              key={slide.id}
              animate={{
                width: index === activeIndex ? DOT_ACTIVE_WIDTH : DOT_SIZE,
                backgroundColor:
                  index === activeIndex
                    ? colors.text.accent
                    : colors.border.dark,
              }}
              transition={reduced ? STILL : DOT_TRANSITION}
              style={styles.dot}
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.ms,
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
    height: DOT_SIZE,
    // From the scale rather than `DOT_SIZE / 2`: a 3.5 nobody can find is how
    // a screen ends up with a sixth radius value.
    borderRadius: radius.pill,
  },
});
