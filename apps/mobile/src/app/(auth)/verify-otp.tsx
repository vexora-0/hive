import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, MAX_OTP_ATTEMPTS } from '@/theme';
import { Text, Button } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
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
      if (!email) return;
      const success = await verifyOTP(email, code);
      if (!success) {
        // Clear the input so the user can try again
        otpRef.current?.clear();
      }
    },
    [email, verifyOTP],
  );

  const handleResend = useCallback(async () => {
    if (!email || !canResend) return;
    await sendOTP(email, signInRole);
    otpRef.current?.clear();
  }, [email, signInRole, canResend, sendOTP]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ── Derived display values ────────────────────────────────────────────
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
    return `${s}s`;
  };

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
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.text.primary}
          />
        </Pressable>

        {/* Heading */}
        <Text variant="h2" style={styles.heading}>
          Enter verification code
        </Text>

        {/* Subtitle */}
        <Text
          variant="body"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          We sent a code to{' '}
          <Text variant="bodyBold" color={colors.text.primary}>
            {email}
          </Text>
        </Text>

        {/* OTP input */}
        <View style={styles.otpContainer}>
          <OTPInput
            ref={otpRef}
            onComplete={handleOTPComplete}
            error={!!error && !isLockedOut}
            disabled={isVerifying || isLockedOut}
          />
        </View>

        {/* Error message */}
        {error && (
          <Text
            variant="bodySmall"
            color={colors.error.main}
            center
            style={styles.errorText}
          >
            {error}
          </Text>
        )}

        {/* Lockout message */}
        {isLockedOut && (
          <View style={styles.lockoutBanner}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.error.dark}
            />
            <Text
              variant="bodySmall"
              color={colors.error.dark}
              style={styles.lockoutText}
            >
              Too many attempts. Try again in {formatTime(lockoutRemaining)}.
            </Text>
          </View>
        )}

        {/* Attempt counter */}
        {!isLockedOut && attemptsRemaining < MAX_OTP_ATTEMPTS && (
          <Text
            variant="caption"
            color={colors.warning.dark}
            center
            style={styles.attemptsText}
          >
            {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
          </Text>
        )}

        {/* Resend section */}
        <View style={styles.resendContainer}>
          {resendCountdown > 0 ? (
            <Text variant="bodySmall" color={colors.text.tertiary} center>
              Resend in {formatTime(resendCountdown)}
            </Text>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleResend}
              loading={isSending}
              disabled={!canResend || isSending}
            >
              Resend Code
            </Button>
          )}
        </View>

        {/* Loading indicator during verification */}
        {isVerifying && (
          <Text
            variant="bodySmall"
            color={colors.text.tertiary}
            center
            style={styles.verifyingText}
          >
            Verifying...
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    marginBottom: spacing.sm,
  },
  subtitle: {
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
    borderRadius: layout.cardRadius,
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
