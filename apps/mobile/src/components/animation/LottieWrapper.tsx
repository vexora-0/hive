import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import LottieView, { type AnimationObject } from 'lottie-react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface LottieWrapperProps {
  /**
   * Lottie animation source.
   * Pass the return value of `require('./animation.json')` **or** a remote URI
   * string (e.g. `"https://assets.example.com/anim.json"`).
   */
  source: AnimationObject | string;
  /** Start playback automatically. @default true */
  autoPlay?: boolean;
  /** Loop the animation continuously. @default true */
  loop?: boolean;
  /** Playback speed multiplier. @default 1 */
  speed?: number;
  /** Optional container style override. */
  style?: StyleProp<ViewStyle>;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * Thin wrapper around `lottie-react-native` that:
 * - Normalises `require()` and URI sources.
 * - Shows a loading indicator until the animation is ready.
 */
export const LottieWrapper: React.FC<LottieWrapperProps> = ({
  source,
  autoPlay = true,
  loop = true,
  speed = 1,
  style,
}) => {
  const lottieRef = useRef<LottieView>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAnimationLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Normalise string URIs into the shape LottieView expects.
  const resolvedSource =
    typeof source === 'string' ? { uri: source } : source;

  return (
    <View style={[styles.container, style]}>
      {isLoading && (
        <ActivityIndicator
          style={styles.loader}
          size="small"
          color={colors.primary.amber}
        />
      )}

      <LottieView
        ref={lottieRef}
        source={resolvedSource}
        autoPlay={autoPlay}
        loop={loop}
        speed={speed}
        style={styles.lottie}
        onAnimationLoaded={handleAnimationLoaded}
      />
    </View>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});

export default LottieWrapper;
