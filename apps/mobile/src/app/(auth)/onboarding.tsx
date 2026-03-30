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

import { colors, spacing, layout } from '@/theme';
import { Text, Button } from '@/components/ui';
import { SafeArea } from '@/components/layout';
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
const DOT_ACTIVE_SIZE = 12;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingSlideData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const { user, setProfile, setRole } = useAuthStore();

  const isLastSlide = activeIndex === slides.length - 1;

  /** After onboarding: if user is signed in, fetch profile and go to app; else go to login. */
  const navigateAfterOnboarding = useCallback(async () => {
    completeOnboarding();
    if (user?.id) {
      const result = await fetchUserProfile(user.id);
      if (result) {
        setProfile(result.profile);
        setRole(result.role);
        router.replace(getRoleRoute(result.role) as never);
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
      <OnboardingSlide slide={item} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: OnboardingSlideData) => item.id,
    [],
  );

  // ── UI ────────────────────────────────────────────────────────────────

  return (
    <SafeArea style={styles.root}>
      {/* Skip button — top right */}
      <View style={styles.header}>
        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text variant="bodyBold" color={colors.text.secondary}>
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
        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleNext}
          style={styles.button}
        >
          {isLastSlide ? 'Get Started' : 'Next'}
        </Button>
      </View>
    </SafeArea>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
    borderRadius: 999,
  },
  dotActive: {
    width: DOT_ACTIVE_SIZE,
    height: DOT_ACTIVE_SIZE,
    backgroundColor: colors.primary.amber,
  },
  dotInactive: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    backgroundColor: colors.gray[300],
  },
  button: {
    width: '100%',
    borderRadius: layout.buttonRadius,
  },
});
