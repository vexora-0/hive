import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

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
            Oops! Something went wrong
          </Text>

          <Text
            variant="body"
            color={colors.text.secondary}
            center
            style={styles.message}
          >
            An unexpected error occurred. Please try again.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={styles.debugBox}>
              <Text variant="caption" color={colors.error.dark}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text variant="bodyBold" color={colors.white}>
              Try Again
            </Text>
          </Pressable>
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
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    maxWidth: '100%',
  },
  button: {
    backgroundColor: colors.primary.amber,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export default ErrorBoundary;
