import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout, MAX_OTP_ATTEMPTS } from '@/theme';
import { Text, Button } from '@/components/ui';
import { Reveal } from '@/components/animation';
import { ScreenContainer } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { OTPInput, type OTPInputHandle } from '@/components/forms/OTPInput';
import { useOTP } from '@/features/auth/hooks/useOTP';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * OTP verification screen — the user enters the 6-digit code sent to their
 * email.
 */
export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email, role } = useLocalSearchParams<{ email: string; role?: 'teacher' | 'parent' }>();
  const otpRef = useRef<OTPInputHandle>(null);
  const signInRole = role === 'teacher' || role === 'parent' ? role : undefined;

  const {
    isVerifying,
    isSending,
    canResend,
    resendCountdown,
    attemptsRemaining,
    isLockedOut,
    lockoutRemaining,
    error,
    sendOTP,
    verifyOTP,
    shakeKey,
  } = useOTP();

  // ── Shake the OTP input when shakeKey bumps ──────────────────────────
  const prevShakeKeyRef = useRef(shakeKey);
  useEffect(() => {
    if (shakeKey !== prevShakeKeyRef.current) {
      prevShakeKeyRef.current = shakeKey;
      otpRef.current?.shake();
    }
  }, [shakeKey]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleOTPComplete = useCallback(
    async (code: string) => {
      const success = await verifyOTP(email, code);
      if (!success) {
        // Clear the input so the user can try again
        otpRef.current?.clear();
      }
    },
    [email, verifyOTP],
  );

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    await sendOTP(email, signInRole);
    otpRef.current?.clear();
  }, [email, signInRole, canResend, sendOTP]);

  const goToLogin = useCallback(() => {
    router.replace('/(auth)/login' as never);
  }, [router]);

  const handleBack = useCallback(() => {
    // `back()` is a no-op with nothing on the stack, and this screen can be the
    // first one — see the deep-link note below. Without the fallback the back
    // arrow does nothing at all in exactly the case the user most needs it.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    goToLogin();
  }, [router, goToLogin]);

  // ── Derived display values ────────────────────────────────────────────
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
    return `${s}s`;
  };

  // ── No email: the screen cannot do anything ──────────────────────────
  // Both handlers need the address the code was sent to — Supabase verifies the
  // token against it — so without the param this screen was inert: it rendered
  // "We sent a code to" followed by nothing, and typing all six digits produced
  // no error, no spinner and no request. This is reachable, not theoretical:
  // app.json declares the `hive` scheme, so `hive:///verify-otp` opens the route
  // directly with no params, and there `router.back()` has no stack to pop
  // either. Fail visibly and hand the user the only route out.
  if (!email) {
    return (
      <ScreenContainer style={styles.missingEmail}>
        <EmptyState
          variant="error"
          title="This link is incomplete."
          message="We don't know which email address to verify. Start again from sign in and we'll send you a fresh code."
          action={{ label: 'Back to sign in', onPress: goToLogin }}
        />
      </ScreenContainer>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll keyboard>
      <View style={styles.content}>
        {/* Back button */}
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={23} color={colors.text.primary} />
        </Pressable>

        <Reveal>
          <Text variant="eyebrow" color={colors.text.tertiary} style={styles.eyebrow}>
            Step 2 of 2
          </Text>
          {/* Sentence case with a full stop, which is the house voice for a
              headline. It is what stops a screen title reading as a tab. */}
          <Text variant="h1" style={styles.heading}>
            Check your email.
          </Text>
        </Reveal>

        <Reveal index={1}>
          <Text variant="body" muted style={styles.subtitle}>
            We sent a 6-digit code to
          </Text>
          {/* Marigold as a surface, never as a label: the chip is the amber
              wash and the address on it is `text.accent` (#9C5A10, 4.81:1 on
              that wash). The glyph takes the same readable tone and the same
              outline hand as every other icon in the app. */}
          <View style={styles.emailChip}>
            <Ionicons name="mail-outline" size={15} color={colors.text.accent} />
            <Text variant="bodySmallBold" color={colors.text.accent} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </Reveal>

        {/* OTP input */}
        <Reveal index={2} style={styles.otpContainer}>
          <OTPInput
            ref={otpRef}
            onComplete={handleOTPComplete}
            error={!!error && !isLockedOut}
            disabled={isVerifying || isLockedOut}
          />
        </Reveal>

        {/* Every message below is set in the semantic `.main` tone rather than
            `.dark`. In this palette `.main` is the text-grade tier — error
            #A32E2A is 6.67:1 on paper and 6.07:1 on its own wash — so the
            darker step was buying contrast nobody needed at the cost of making
            a mistyped digit look like a system fault. */}
        {error && (
          <Text
            variant="bodySmall"
            color={colors.error.main}
            center
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.errorText}
          >
            {error}
          </Text>
        )}

        {isLockedOut && (
          <View
            style={styles.lockoutBanner}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.error.main}
            />
            <Text
              variant="bodySmall"
              color={colors.error.main}
              style={styles.lockoutText}
            >
              Too many tries. You can try again in {formatTime(lockoutRemaining)}.
            </Text>
          </View>
        )}

        {!isLockedOut && attemptsRemaining < MAX_OTP_ATTEMPTS && (
          <Text
            variant="caption"
            color={colors.warning.main}
            center
            style={styles.attemptsText}
          >
            {attemptsRemaining} tr{attemptsRemaining === 1 ? 'y' : 'ies'} left.
          </Text>
        )}

        {/* Resend section */}
        <View style={styles.resendContainer}>
          {resendCountdown > 0 ? (
            <Text variant="bodySmall" color={colors.text.tertiary} center>
              You can ask again in {formatTime(resendCountdown)}.
            </Text>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleResend}
              loading={isSending}
              disabled={!canResend || isSending}
            >
              Send a new code
            </Button>
          )}
        </View>

        {isVerifying && (
          <Text
            variant="bodySmall"
            color={colors.text.tertiary}
            center
            accessibilityLiveRegion="polite"
            style={styles.verifyingText}
          >
            Checking your code…
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  missingEmail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.ms,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    marginBottom: spacing.sm,
  },
  heading: {
    marginBottom: spacing.ms,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    maxWidth: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderRadius: radius.xs,
    backgroundColor: colors.primary.amberWash,
    marginBottom: spacing.xl,
  },
  otpContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    marginBottom: spacing.sm,
  },
  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error.background,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  lockoutText: {
    flexShrink: 1,
  },
  attemptsText: {
    marginBottom: spacing.md,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  verifyingText: {
    marginTop: spacing.md,
  },
});
