import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors } from '@/theme';
import { SafeArea } from '@/components/layout';
import { EmptyState } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * 404 — the route does not exist.
 *
 * Two things were wrong with this screen and both were admitted in the code.
 *
 * The hero was **a placeholder**: a flat circle 45% of the screen wide, filled
 * with `primary.amberLight`, with a compass glyph scaled up to half its width
 * sitting in the middle. A 24-grid icon rendered at ~85pt draws a 7pt stroke,
 * which is a blob, and a 170pt disc of the palette's lightest marigold is the
 * single loudest shape the app would ever have put on paper — on the one screen
 * that exists to say quietly that something went wrong. It is now
 * `<OpenWindow>` from the spot-illustration set: one ink line on the 120 grid
 * at 2.5, the same hand as the icons, chosen because the drawing says *the view
 * is still there, we just cannot reach it from here*, which is exactly what a
 * missing route means.
 *
 * And the copy was written for a child — "Oops! Page not found", "This bee got
 * lost!" — when nobody using Hive is one. A parent who has just tapped a stale
 * link wants to know whether their photographs are all right. So the message
 * says so, in a sentence an adult would say out loud.
 *
 * The whole screen is now `<EmptyState variant="error">`, which brings the
 * drawing, the entrance, the live region a screen reader needs, and the rule
 * that an error state always carries a way out.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  const handleGoHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  return (
    <SafeArea>
      <View style={styles.container}>
        <EmptyState
          variant="error"
          title="We can't find that page."
          message="The link may be out of date, or the screen may have moved. Everything of yours is right where you left it."
          action={{ label: 'Back to Hive', onPress: handleGoHome }}
        />
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
    backgroundColor: colors.background.cream,
  },
});
