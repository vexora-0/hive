import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';

import { colors, spacing, layout } from '@/theme';
import { Text, Button } from '@/components/ui';
import { SafeArea } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { OnboardingSlide } from '@/features/onboarding/components/OnboardingSlide';
import { slides, type OnboardingSlideData } from '@/features/onboarding/data/slides';
import { useOnboardingStore } from '@/features/onboarding/stores/onboardingStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { fetchUserProfile } from '@/features/auth/services/authService';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 26;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingSlideData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Measured once, then handed to each slide — see the note on
  // `OnboardingSlideProps.height`.
  const [pagerHeight, setPagerHeight] = useState(0);
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

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    navigateAfterOnboarding();
  }, [navigateAfterOnboarding]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      navigateAfterOnboarding();
    } else {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    }
  }, [isLastSlide, activeIndex, navigateAfterOnboarding]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(
        event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
      );
      setActiveIndex(index);
    },
    [],
  );

  // ── Render helpers ────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingSlideData>) => (
      <OnboardingSlide slide={item} height={pagerHeight} />
    ),
    [pagerHeight],
  );

  const keyExtractor = useCallback(
    (item: OnboardingSlideData) => item.id,
    [],
  );

  // ── UI ────────────────────────────────────────────────────────────────

  // The account exists but we could not load it. Retrying is the only sensible
  // action, and it has to be offered — the previous behaviour was to bounce to
  // login, which retried the same call and bounced back.
  if (lookupFailed) {
    return (
      <SafeArea style={styles.root}>
        <View style={styles.lookupError}>
          <EmptyState
            title="Couldn't load your account"
            message="Check your connection and try again."
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
      {/* Skip button — top right */}
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

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.slides}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Page indicators — the active one stretches into a bar rather than
            growing into a bigger circle, so progress through the three slides
            is readable as a length, not just a highlight. */}
        <View
          style={styles.dotsRow}
          accessibilityRole="progressbar"
          accessibilityLabel={`Slide ${activeIndex + 1} of ${slides.length}`}
        >
          {slides.map((slide, index) => (
            <MotiView
              key={slide.id}
              animate={{
                width: index === activeIndex ? DOT_ACTIVE_WIDTH : DOT_SIZE,
                backgroundColor:
                  index === activeIndex ? colors.primary.amber : colors.gray[300],
              }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.ms,
  },
  slides: {
    flex: 1,
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
    borderRadius: DOT_SIZE / 2,
  },
});
