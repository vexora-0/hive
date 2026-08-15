import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout, MIN_TAP_SIZE } from '@/theme';
import {
  Text,
  Button,
  TextInput,
  SegmentedControl,
  type SegmentOption,
} from '@/components/ui';
import { HoneycombPattern, Reveal } from '@/components/animation';
import { HiveMark } from '@/components/brand';
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
 * Login screen — choose Parent, Teacher, or Admin, enter email, then:
 *   - Parent / Teacher → OTP flow (or an opt-in password)
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
      setEmailError('Enter the email your school has on file.');
      return false;
    }
    // Simple RFC-ish check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('That does not look like an email address.');
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
        setPasswordError('Enter your password.');
        return;
      }
      setPasswordError(undefined);
      setAdminError(undefined);

      try {
        setIsSigningIn(true);
        await signInWithPassword(trimmed, password);
        // useSession hook picks up SIGNED_IN and routes to the role's home
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Sign-in failed. Try again.';
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

  // ── Role options ────────────────────────────────────────────────────
  //
  // Three segments, which is the cap, and three **outline** glyphs. Fill is
  // reserved across the app for a selected state, and `SegmentOption.icon`
  // receives only the resolved colour — it cannot tell whether it is the
  // selected one — so a filled glyph here would mark all three as active at
  // once. The thumb behind the label already says which is chosen.
  const roleOptions = useMemo<SegmentOption<SignInRole>[]>(
    () => [
      {
        value: 'parent',
        label: 'Parent',
        icon: (color) => <Ionicons name="heart-outline" size={15} color={color} />,
      },
      {
        value: 'teacher',
        label: 'Teacher',
        icon: (color) => <Ionicons name="school-outline" size={15} color={color} />,
      },
      {
        value: 'admin',
        label: 'Admin',
        icon: (color) => <Ionicons name="shield-outline" size={15} color={color} />,
      },
    ],
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll keyboard>
      {/* Ambient comb in the corner. A wide field of it draws a visible
          vertical seam down the middle of the screen where the tessellation
          ends, so it is kept to a cluster that runs off two edges. */}
      <View pointerEvents="none" style={styles.combLayer}>
        <View style={styles.combInner}>
          <HoneycombPattern rows={3} cols={4} size={38} />
        </View>
      </View>

      <View style={styles.content}>
        <Reveal scale distance={20}>
          <HiveMark size={54} style={styles.mark} />
        </Reveal>

        {/* Sentence case with a full stop — the house voice for a headline. */}
        <Reveal index={1}>
          <Text variant="h1" style={styles.heading}>
            {isAdmin ? 'Administrator sign-in.' : 'Welcome to Hive.'}
          </Text>
        </Reveal>

        {/* The one editorial line the screen is allowed — Fraunces italic, and
            only for a parent or a teacher. The admin door stays in the sans:
            an administrator opening this screen is at work, and a warm serif
            promise about their child would be addressed to the wrong person. */}
        <Reveal index={2}>
          {isAdmin ? (
            <Text variant="body" muted style={styles.subtitle}>
              Manage schools, classes and people.
            </Text>
          ) : (
            <Text
              variant="editorial"
              color={colors.text.secondary}
              style={styles.subtitle}
            >
              Your child&apos;s week at school, kept private.
            </Text>
          )}
        </Reveal>

        <Reveal index={3} style={styles.block}>
          {/* A form label, not a region name — so it is set in sentence case
              rather than as a spaced capital eyebrow. "I AM A" shouted at
              somebody who has just opened the app. */}
          <Text variant="label" color={colors.text.secondary} style={styles.fieldLabel}>
            I am a
          </Text>
          <SegmentedControl
            options={roleOptions}
            value={signInAs}
            onChange={setSignInAs}
            disabled={isLoading}
            accessibilityLabel="Choose how you are signing in"
          />
        </Reveal>

        <Reveal index={4} style={styles.block}>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            hint={
              isPasswordMode
                ? undefined
                : "We'll send a 6-digit code to this address."
            }
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
            leftIcon={
              <Ionicons name="mail-outline" size={18} color={colors.text.tertiary} />
            }
          />
        </Reveal>

        {isPasswordMode && (
          <Reveal style={styles.block}>
            <TextInput
              label="Password"
              placeholder="Your password"
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
              leftIcon={
                <Ionicons name="lock-closed-outline" size={18} color={colors.text.tertiary} />
              }
            />
          </Reveal>
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
            <Text variant="bodySmallBold" color={colors.text.accent}>
              {usePassword ? 'Use a one-time code instead' : 'Use a password instead'}
            </Text>
          </Pressable>
        )}

        {/* Announced on arrival. A sign-in failure that only appears is a
            failure a screen-reader user has to go hunting for. */}
        {serverError && (
          <View
            style={styles.errorBox}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Ionicons
              name="alert-circle-outline"
              size={17}
              color={colors.error.main}
            />
            <Text variant="bodySmall" color={colors.error.main} style={styles.errorText}>
              {serverError}
            </Text>
          </View>
        )}

        <Reveal index={5} style={styles.block}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSignIn}
            loading={isLoading}
            disabled={isLoading}
          >
            {isPasswordMode ? 'Sign in' : 'Send code'}
          </Button>
        </Reveal>

        <Text variant="caption" color={colors.text.tertiary} center style={styles.footer}>
          Only addresses your school has registered can sign in.
        </Text>
      </View>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /**
   * A clipping window for the comb. Without it the pattern's negative offsets
   * widen the scroll view and the whole screen scrolls sideways — which is
   * exactly what a decoration must never do.
   */
  combLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    overflow: 'hidden',
  },
  combInner: {
    position: 'absolute',
    top: -46,
    right: -54,
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xxl,
  },
  mark: {
    marginBottom: spacing.lg,
  },
  heading: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  block: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
  },
  switchMethod: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    // Text-only control: without an explicit floor this is ~26px tall, under
    // the 44px minimum every other tappable element in the app honours.
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.ms,
    marginBottom: spacing.md,
    // Was a literal 14 — the same number `radius.sm` holds, but a number the
    // scale cannot move. Every corner on this screen now comes from the scale.
    borderRadius: radius.sm,
    backgroundColor: colors.error.background,
  },
  errorText: {
    flex: 1,
  },
  footer: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
