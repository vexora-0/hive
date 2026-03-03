import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, spacing } from '@/theme';
import { Text, Button } from '@/components/ui';
import { SafeArea } from '@/components/layout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEE_SIZE = Dimensions.get('window').width * 0.45;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * 404 — Not Found screen.
 *
 * Displayed when the user navigates to a route that does not exist.
 * Shows a playful bee-themed message and a button to return home.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  const handleGoHome = () => {
    router.replace('/');
  };

  return (
    <SafeArea>
      <View style={styles.container}>
        {/* Lottie bee animation placeholder */}
        <View style={styles.beeContainer}>
          <View style={styles.beePlaceholder}>
            <Text variant="h1" center>
              {'🐝'}
            </Text>
          </View>
        </View>

        {/* Heading */}
        <Text variant="h2" center style={styles.heading}>
          Oops! Page not found
        </Text>

        {/* Subtitle */}
        <Text
          variant="body"
          color={colors.text.secondary}
          center
          style={styles.subtitle}
        >
          This bee got lost!
        </Text>

        {/* Go Home button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleGoHome}
          style={styles.button}
        >
          Go Home
        </Button>
      </View>
    </SafeArea>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.cream,
  },
  beeContainer: {
    width: BEE_SIZE,
    height: BEE_SIZE,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beePlaceholder: {
    width: BEE_SIZE,
    height: BEE_SIZE,
    borderRadius: BEE_SIZE / 2,
    backgroundColor: colors.primary.amberLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  button: {
    width: '80%',
  },
});
