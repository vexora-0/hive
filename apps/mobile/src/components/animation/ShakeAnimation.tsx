import React, { forwardRef, useCallback, useImperativeHandle } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ShakeAnimationHandle {
  /** Trigger a horizontal shake animation. */
  shake: () => void;
}

export interface ShakeAnimationProps {
  children: React.ReactNode;
  /** Optional container style. */
  style?: StyleProp<ViewStyle>;
  /** Total horizontal displacement in px (each side). @default 10 */
  offset?: number;
  /** Number of oscillations in a single shake burst. @default 4 */
  oscillations?: number;
  /** Duration of each half-oscillation in ms. @default 50 */
  stepDuration?: number;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * Wrapper that shakes its children horizontally.
 *
 * Expose the `shake()` method via a ref:
 *
 * ```tsx
 * const shakeRef = useRef<ShakeAnimationHandle>(null);
 * <ShakeAnimation ref={shakeRef}>
 *   <TextInput />
 * </ShakeAnimation>
 *
 * // Later:
 * shakeRef.current?.shake();
 * ```
 */
export const ShakeAnimation = forwardRef<
  ShakeAnimationHandle,
  ShakeAnimationProps
>(({ children, style, offset = 10, oscillations = 4, stepDuration = 50 }, ref) => {
  const translateX = useSharedValue(0);

  const shake = useCallback(() => {
    // Build a sequence: left, right, left, right, ... back to centre.
    const steps: ReturnType<typeof withTiming>[] = [];
    const timingConfig = {
      duration: stepDuration,
      easing: Easing.linear,
    };

    for (let i = 0; i < oscillations; i++) {
      steps.push(withTiming(-offset, timingConfig));
      steps.push(withTiming(offset, timingConfig));
    }
    // Return to rest
    steps.push(withTiming(0, timingConfig));

    translateX.value = withSequence(...steps);
  }, [offset, oscillations, stepDuration, translateX]);

  useImperativeHandle(ref, () => ({ shake }), [shake]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
});

ShakeAnimation.displayName = 'ShakeAnimation';

export default ShakeAnimation;
