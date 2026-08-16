import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  play,
  spacing,
  radius,
  layout,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text, Button, TextInput } from '@/components/ui';
import { Reveal } from '@/components/animation';
import { HiveMark } from '@/components/brand';
import { Bo, SpeechBubble, type BoPose } from '@/components/mascot';
import { Doodle, PlayfulBackdrop } from '@/components/decor';
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
// Roles
// ---------------------------------------------------------------------------

interface RoleSpec {
  value: SignInRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** The role's play hue — the same one its avatars and badges use. */
  hue: { soft: string; base: string; deep: string };
}

/**
 * The three doors, in the order a school's people actually arrive at them.
 *
 * Parent first because there are two hundred of them for every admin, and the
 * default selection should be the overwhelmingly likely one rather than the
 * alphabetically first.
 */
const ROLES: readonly RoleSpec[] = [
  { value: 'parent', label: 'Parent', icon: 'heart', hue: play.berry },
  { value: 'teacher', label: 'Teacher', icon: 'school', hue: play.sky },
  { value: 'admin', label: 'Admin', icon: 'shield', hue: play.grape },
];

/**
 * `<RoleCard>` — one of the three.
 *
 * A quiet pill. The first version of this was a 76pt bordered tile with a
 * filled wash and a 2.5pt coloured edge, three across, and on a cream page it
 * read as three loud buttons demanding a decision before anybody had been
 * greeted. The screen is a front door, not a form to be got through.
 *
 * So the unselected state is **nothing at all** — no border, no fill, just the
 * word and a line glyph on the page. Only the chosen one draws a surface, in
 * the softest tint of its role's hue, and even that sits at a contrast you have
 * to be looking at it to notice. The difference is still carried three ways
 * (fill, glyph weight, text colour) so it never depends on hue alone.
 */
function RoleCard({
  role,
  selected,
  disabled,
  onPress,
}: {
  role: RoleSpec;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`Sign in as ${role.label}`}
      style={({ pressed }) => [
        styles.roleCard,
        selected && { backgroundColor: role.hue.soft },
        pressed && styles.roleCardPressed,
      ]}
    >
      <Ionicons
        name={selected ? role.icon : (`${role.icon}-outline` as keyof typeof Ionicons.glyphMap)}
        size={17}
        color={selected ? role.hue.deep : colors.text.tertiary}
      />
      <Text
        variant="bodySmallBold"
        color={selected ? role.hue.deep : colors.text.tertiary}
      >
        {role.label}
      </Text>
    </Pressable>
  );
}

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

  /**
   * Whether the password field has the caret.
   *
   * This exists for exactly one reason and it is worth the state: while
   * somebody is typing a password, **Bo covers her eyes.** It is the smallest
   * possible piece of interaction design and it does more for this product's
   * central promise — that Hive does not look at things it has no business
   * looking at — than the sentence under the headline does. A parent will
   * remember the bee that turned away. Nobody remembers a privacy notice.
   */
  const [passwordFocused, setPasswordFocused] = useState(false);

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

  // ── The mascot's state ──────────────────────────────────────────────
  //
  // Three cases, and the middle one is the whole point of putting her here.
  const boPose: BoPose = passwordFocused
    ? 'hide'
    : isAdmin
      ? 'idle'
      : 'peek';

  // The tint of the light behind the screen follows the role being chosen, so
  // the door changes colour as you say who you are. It is a small thing that
  // makes a static form feel like it is listening.
  const tint = isAdmin
    ? play.grape.base
    : signInAs === 'teacher'
      ? play.sky.base
      : play.honey.base;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll keyboard>
      <PlayfulBackdrop level="hero" tint={tint} />

      <View style={styles.content}>
        {/* The masthead, matching the intro carousel's. Somebody who skipped
            onboarding arrives here having never seen the product's name. */}
        <View style={styles.masthead}>
          <HiveMark size={30} />
          <Text variant="h4" style={styles.wordmark}>
            Hive
          </Text>
        </View>

        {/*
          Bo stands **on top of the card's edge**, half over and half behind it.

          That overlap is the whole composition. A sign-in form is a stack of
          rectangles no matter what you do to it, and the one reliable way to
          stop it reading as a stack of rectangles is to break the top edge with
          something that is not one. She is drawn before the card and pulled
          down over it, so the card's corner passes behind her feet.
        */}
        <View style={styles.hero}>
          <Bo pose={boPose} size={104} style={styles.heroBo} />

          {passwordFocused && (
            <SpeechBubble tail="bottom" tailAt={0.2} style={styles.heroBubble}>
              Eyes shut.
            </SpeechBubble>
          )}
        </View>

        {/*
          No card.

          There was a white sheet here with a drawn scalloped edge, and it was
          the thing that made this screen look bolted on: a hard #FFFFFF panel
          with a shadow, on a page whose entire character is warm paper under
          soft light. Every other screen in the app lets its content sit
          directly on that paper. This one does too now, and the form is held
          together by spacing rather than by a box drawn around it.
        */}
        <View style={styles.form}>
          <Reveal>
            {isAdmin ? (
              <Text variant="h2" style={styles.heading}>
                Administrator sign-in.
              </Text>
            ) : (
              <View style={styles.heading}>
                <Text variant="playTitle">Welcome back.</Text>
                <Doodle
                  kind="underline"
                  size={132}
                  color={tint}
                  opacity={0.9}
                  style={styles.headingMark}
                />
              </View>
            )}
          </Reveal>

          <Reveal index={1}>
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

          {/*
            Three cards, not a segmented control.

            "Who are you" is the first real decision on this screen and it
            changes everything below it — which fields appear, which colour the
            light behind the screen is, whether the copy is warm or
            businesslike. A 32px-tall segment with a 15px glyph made the most
            consequential choice on the page the smallest control on it. Each
            card carries its role's own play hue, which is the same hue the
            avatars and badges use for that role everywhere else in the app.
          */}
          <Reveal index={2} style={styles.block}>
            <Text
              variant="label"
              color={colors.text.secondary}
              style={styles.fieldLabel}
            >
              I am a
            </Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <RoleCard
                  key={role.value}
                  role={role}
                  selected={signInAs === role.value}
                  disabled={isLoading}
                  onPress={() => setSignInAs(role.value)}
                />
              ))}
            </View>
          </Reveal>

          <Reveal index={3} style={styles.block}>
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
                // Drives Bo's pose. `TextInput` forwards both handlers after
                // running its own focus ring, so nothing is overridden here.
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                leftIcon={
                  <Ionicons name="lock-closed-outline" size={18} color={colors.text.tertiary} />
                }
              />
            </Reveal>
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

          <Reveal index={4} style={styles.block}>
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
        </View>

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
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.md,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_SIZE,
  },
  wordmark: {
    letterSpacing: 0.2,
  },

  // ── The hero band ──────────────────────────────────────────────────
  //
  // Bo is small here and standing off to one side, not presiding over the
  // form. She is a companion at the door, and the greeting under her is what
  // the screen is actually saying. The band's height is fixed so the whole
  // form does not jump when her speech bubble appears under somebody's thumb.
  hero: {
    height: 92,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: spacing.xs,
  },
  heroBo: {
    marginBottom: -spacing.xs,
  },
  heroBubble: {
    marginLeft: spacing.sm,
    marginBottom: spacing.md,
    flexShrink: 1,
  },

  // ── The form ───────────────────────────────────────────────────────
  //
  // Held together by spacing, not by a box. See the note at the call site for
  // why the white card that used to be here is gone.
  form: {
    marginTop: spacing.md,
  },

  heading: {
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  headingMark: {
    marginTop: -spacing.sm,
    marginLeft: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  block: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
  },

  // ── Role pills ─────────────────────────────────────────────────────
  //
  // A recessed track holding three pills, which is the same shape the app's
  // `SegmentedControl` uses everywhere else — this screen is not inventing a
  // new selection idiom, only giving the three roles their own colours.
  roleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.surfaceSecondary,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.ms,
    borderRadius: radius.pill,
    minHeight: MIN_TAP_SIZE,
  },
  roleCardPressed: {
    opacity: 0.6,
  },

  switchMethod: {
    alignSelf: 'center',
    justifyContent: 'center',
    // Text-only control: without an explicit floor this is ~26px tall, under
    // the 44px minimum every other tappable element in the app honours.
    minHeight: MIN_TAP_SIZE,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.ms,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.error.background,
  },
  errorText: {
    flex: 1,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
