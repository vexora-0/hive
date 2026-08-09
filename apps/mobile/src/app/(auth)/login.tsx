import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, MIN_TAP_SIZE } from '@/theme';
import { Text, Button, TextInput } from '@/components/ui';
import { LottieWrapper, HoneycombPattern } from '@/components/animation';
import { ScreenContainer } from '@/components/layout';
import { useOTP } from '@/features/auth/hooks/useOTP';
import { useAuthStore } from '@/features/auth/stores/authStore';
import {
  fetchUserProfile,
  signInWithPassword,
} from '@/features/auth/services/authService';
import { getRoleRoute } from '@/types/navigation';
import { logger } from '@/utils/logger';

type SignInRole = 'teacher' | 'parent' | 'admin';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Login screen — choose Teacher, Parent, or Admin, enter email, then:
 *   - Teacher / Parent → OTP flow
 *   - Admin → email + password
 */
export default function LoginScreen() {
  const router = useRouter();
  const { isSending, error: otpError, sendOTP } = useOTP();
  const { user, role, setProfile, setRole } = useAuthStore();

  const [signInAs, setSignInAs] = useState<SignInRole>('parent');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [adminError, setAdminError] = useState<string | undefined>(undefined);

  const isAdmin = signInAs === 'admin';

  // Teachers and parents default to OTP, but can switch to a password.
  //
  // OTP alone made several accounts unreachable: the seeded demo accounts use
  // .demo domains, which cannot receive mail, and Supabase's default SMTP is
  // rate-limited to a handful of messages an hour — unreliable for a live
  // demonstration even with real addresses. signInWithPassword already existed;
  // it simply was not reachable for these roles.
  const [usePassword, setUsePassword] = useState(false);
  const isPasswordMode = isAdmin || usePassword;

  // `useOTP` owns its error and exposes no reset, so a failed send would keep
  // showing after switching to password and back. Mark it stale on any switch
  // and clear the mark when a send is actually attempted.
  const [otpErrorStale, setOtpErrorStale] = useState(false);

  const isLoading = isPasswordMode ? isSigningIn : isSending;
  const serverError = isPasswordMode
    ? adminError
    : otpErrorStale
      ? undefined
      : otpError;

  // ── Already signed in: redirect to role-based home ───────────────────
  useEffect(() => {
    if (!user?.id) return;
    if (role) {
      router.replace(getRoleRoute(role) as never);
      return;
    }
    fetchUserProfile(user.id)
      .then((result) => {
        if (result) {
          setProfile(result.profile);
          setRole(result.role);
          router.replace(getRoleRoute(result.role) as never);
        }
      })
      .catch((err) => {
        // Previously this rejected silently: the user stayed signed in, sitting
        // on a login form, with no error and no way to tell why. Entering their
        // email again just re-ran the same failing lookup.
        logger.error('Could not load profile for a signed-in user', err);
      });
  }, [user?.id, role, setProfile, setRole, router]);

  // Switching role resets the opt-in, so a teacher does not silently inherit
  // password mode from a previous admin selection. Credentials are cleared here
  // too: going parent-with-password → admin keeps `isPasswordMode` true, so the
  // effect below never fires and a typed password would carry into the admin
  // form.
  useEffect(() => {
    setUsePassword(false);
    setPassword('');
    setPasswordError(undefined);
    setAdminError(undefined);
    setOtpErrorStale(true);
  }, [signInAs]);

  // ── Clear password state when leaving password mode ───────────────────
  useEffect(() => {
    if (!isPasswordMode) {
      setPassword('');
      setPasswordError(undefined);
      setAdminError(undefined);
    }
  }, [isPasswordMode]);

  // ── Validation ──────────────────────────────────────────────────────
  const validateEmail = useCallback((value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return false;
    }
    // Simple RFC-ish check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError(undefined);
    return true;
  }, []);

  // ── Sign-in handler ──────────────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    const trimmed = email.trim();
    if (!validateEmail(trimmed)) return;

    if (isPasswordMode) {
      // ── Password sign-in ──────────────────────────────────────────
      if (!password.trim()) {
        setPasswordError('Password is required.');
        return;
      }
      setPasswordError(undefined);
      setAdminError(undefined);

      try {
        setIsSigningIn(true);
        await signInWithPassword(trimmed, password);
        // useSession hook picks up SIGNED_IN and routes to admin dashboard
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Login failed. Please try again.';
        setAdminError(message);
      } finally {
        setIsSigningIn(false);
      }
    } else {
      // ── Teacher / Parent: OTP ──────────────────────────────────────
      // A send is being attempted, so whatever useOTP reports next is current.
      setOtpErrorStale(false);
      const success = await sendOTP(trimmed, signInAs as 'teacher' | 'parent');
      if (success) {
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { email: trimmed, role: signInAs },
        } as never);
      }
    }
  }, [email, password, signInAs, isPasswordMode, validateEmail, sendOTP, router]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll keyboard>
      {/* Honeycomb decoration */}
      <View style={styles.honeycombContainer}>
        <HoneycombPattern rows={4} cols={8} size={28} style={styles.honeycomb} />
      </View>

      <View style={styles.content}>
        {/* Lottie animation */}
        <View style={styles.lottieContainer}>
          <LottieWrapper
            source="https://assets.lottiefiles.com/packages/lf20_hu9cd9.json"
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        {/* Heading */}
        <Text variant="h1" center style={styles.heading}>
          Welcome to Hive
        </Text>

        {/* Subtitle */}
        <Text
          variant="body"
          color={colors.text.secondary}
          center
          style={styles.subtitle}
        >
          Sign in with your email
        </Text>

        {/* Role selector: Teacher, Parent, or Admin */}
        <Text variant="bodyBold" style={styles.roleLabel}>
          I am a
        </Text>
        <View style={styles.roleRow}>
          <Pressable
            onPress={() => setSignInAs('teacher')}
            style={[
              styles.roleOption,
              signInAs === 'teacher' && styles.roleOptionSelected,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: signInAs === 'teacher' }}
            accessibilityLabel="Sign in as Teacher"
          >
            <Ionicons
              name="school-outline"
              size={22}
              color={signInAs === 'teacher' ? colors.primary.amberDark : colors.text.secondary}
            />
            <Text
              variant="body"
              color={signInAs === 'teacher' ? colors.primary.amberDark : colors.text.secondary}
              style={styles.roleOptionText}
            >
              Teacher
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSignInAs('parent')}
            style={[
              styles.roleOption,
              signInAs === 'parent' && styles.roleOptionSelected,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: signInAs === 'parent' }}
            accessibilityLabel="Sign in as Parent"
          >
            <Ionicons
              name="people-outline"
              size={22}
              color={signInAs === 'parent' ? colors.primary.amberDark : colors.text.secondary}
            />
            <Text
              variant="body"
              color={signInAs === 'parent' ? colors.primary.amberDark : colors.text.secondary}
              style={styles.roleOptionText}
            >
              Parent
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSignInAs('admin')}
            style={[
              styles.roleOption,
              signInAs === 'admin' && styles.roleOptionSelected,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: signInAs === 'admin' }}
            accessibilityLabel="Sign in as Admin"
          >
            <Ionicons
              name="shield-outline"
              size={22}
              color={signInAs === 'admin' ? colors.primary.amberDark : colors.text.secondary}
            />
            <Text
              variant="body"
              color={signInAs === 'admin' ? colors.primary.amberDark : colors.text.secondary}
              style={styles.roleOptionText}
            >
              Admin
            </Text>
          </Pressable>
        </View>

        {/* Email input */}
        <TextInput
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType={isPasswordMode ? 'next' : 'go'}
          onSubmitEditing={isPasswordMode ? undefined : handleSignIn}
          editable={!isLoading}
          containerStyle={styles.input}
        />

        {/* Password input */}
        {isPasswordMode && (
          <TextInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
            editable={!isLoading}
            containerStyle={styles.input}
          />
        )}

        {/* Teachers and parents can opt into a password instead of an OTP. */}
        {!isAdmin && (
          <Pressable
            onPress={() => {
              setUsePassword((v) => !v);
              setOtpErrorStale(true);
            }}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={
              usePassword ? 'Use a one-time code instead' : 'Use a password instead'
            }
            style={styles.switchMethod}
          >
            <Text variant="bodySmall" color={colors.text.link}>
              {usePassword ? 'Use a one-time code instead' : 'Use a password instead'}
            </Text>
          </Pressable>
        )}

        {/* Server error */}
        {serverError && (
          <Text variant="bodySmall" color={colors.error.main} style={styles.error}>
            {serverError}
          </Text>
        )}

        {/* Sign-in button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleSignIn}
          loading={isLoading}
          disabled={isLoading}
          style={styles.button}
        >
          {isPasswordMode ? 'Sign In' : 'Send Code'}
        </Button>
      </View>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  honeycombContainer: {
    position: 'absolute',
    top: -20,
    right: -40,
    opacity: 0.5,
  },
  honeycomb: {
    // Positioned by parent
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  lottieContainer: {
    width: 180,
    height: 180,
    marginBottom: spacing.lg,
  },
  lottie: {
    width: 180,
    height: 180,
  },
  heading: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  roleLabel: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: layout.inputRadius,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.surface,
  },
  roleOptionSelected: {
    borderColor: colors.primary.amber,
    backgroundColor: colors.primary.amberLight + '20',
  },
  roleOptionText: {
    fontFamily: 'Nunito_600SemiBold',
  },
  input: {
    width: '100%',
    marginBottom: spacing.md,
  },
  switchMethod: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    // Text-only control: without an explicit floor this is ~26px tall, under
    // the 44px minimum every other tappable element in the app honours.
    minHeight: MIN_TAP_SIZE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  error: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    borderRadius: layout.buttonRadius,
  },
});
