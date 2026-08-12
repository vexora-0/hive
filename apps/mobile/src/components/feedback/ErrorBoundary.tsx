import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  /** Content rendered when there is no error. */
  children: ReactNode;
  /** Optional custom fallback UI. When omitted the default error screen is shown. */
  fallback?: ReactNode;
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
 * JavaScript errors anywhere in its child tree and shows a friendly
 * recovery screen instead of a white screen of death.
 *
 * ```tsx
 * <ErrorBoundary>
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
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text variant="h2" center style={styles.title}>
            This screen stopped working
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
  title: {
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.lg,
  },
  debugBox: {
    backgroundColor: colors.error.background,
    borderRadius: radius.xs,
    padding: spacing.md,
    marginBottom: spacing.lg,
    maxWidth: '100%',
  },
});

export default ErrorBoundary;
