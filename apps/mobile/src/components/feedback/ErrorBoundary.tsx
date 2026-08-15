import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { OpenWindow } from '@/components/illustration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  /** Content rendered when there is no error. */
  children: ReactNode;
  /** Optional custom fallback UI. When omitted the default error screen is shown. */
  fallback?: ReactNode;
  /**
   * Called after "Try again" clears the error, before the children re-render.
   * Use it to refetch whatever the failed render depended on — the boundary can
   * only clear its own state, and re-rendering the same bad data crashes again
   * immediately.
   */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ErrorBoundary>` — a React class component that catches unhandled
 * JavaScript errors anywhere in its child tree and shows a recovery screen
 * instead of a white screen of death.
 *
 * It is the only screen in the app nobody designed, which is exactly why it
 * needed one: a parent who meets a bare stack trace learns that the place their
 * child's photographs live is unreliable. So it reads like the rest of Hive —
 * paper ground, one spot illustration, a sentence that says what happened and
 * what was *not* lost, and a single way forward.
 *
 * The drawing is the open window, the same one an offline or failed-request
 * state uses: the view is still there, we simply cannot reach it this second.
 * That is both truer and calmer than a broken plug.
 *
 * **Nothing here animates.** Every other surface in the app arrives; this one
 * is already present when the person looks at it. An entrance on a crash screen
 * is the app performing composure it has not earned.
 *
 * ```tsx
 * <ErrorBoundary onReset={() => queryClient.resetQueries()}>
 *   <MyScreen />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // You can log to an external service here.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container} accessibilityLiveRegion="polite">
          <OpenWindow style={styles.illustration} />

          <Text variant="h2" center accessibilityRole="header" style={styles.title}>
            This screen stopped working.
          </Text>

          <Text variant="body" muted center style={styles.message}>
            Nothing was lost. Try again, and if it keeps happening, sign out and
            back in.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={styles.debugBox}>
              <Text variant="caption" color={colors.error.dark}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          <Button variant="primary" onPress={this.handleRetry}>
            Try again
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  illustration: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  debugBox: {
    backgroundColor: colors.error.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    maxWidth: '100%',
  },
});

export default ErrorBoundary;
