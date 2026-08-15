import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text, Button, Avatar, TextInput, Card, Badge, Divider } from '@/components/ui';
import { Reveal } from '@/components/animation';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { BottomSheet, ConfirmDialog } from '@/components/feedback';
import type { UserRole } from '@/types/supabase';
import { useAuthStore } from '../stores/authStore';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

/**
 * What each role is called on their own profile.
 *
 * Written out rather than title-cased from the enum: "Admin" is the database's
 * word for the row, and the person reading it is a nursery manager, not a
 * record type. The badge is deliberately **neutral grey in all three cases**.
 * Tinting it by role would put a third hue on a screen whose only job is to
 * confirm who you are, and the avatar beside it already carries a deterministic
 * identity colour derived from the name.
 */
const ROLE_LABEL: Record<UserRole, string> = {
  parent: 'Parent',
  teacher: 'Teacher',
  admin: 'Administrator',
};

// ---------------------------------------------------------------------------
// Edit sheet
// ---------------------------------------------------------------------------

interface EditSheetProps {
  visible: boolean;
  initialName: string;
  initialPhone: string;
  isSaving: boolean;
  onSave: (name: string, phone: string) => void;
  onClose: () => void;
}

/**
 * The edit form, on the app's one sheet.
 *
 * This used to be a hand-rolled `Modal` with its own backdrop, its own 40×4
 * handle bar, its own cream ground and its own corner radius — one of fourteen
 * such sheets, no two of which agreed on all four. `<BottomSheet>` owns the
 * scrim, the handle, the safe-area inset, the keyboard inset and the height
 * ceiling now, so this file is only the two fields and the two buttons.
 */
function EditProfileSheet({
  visible,
  initialName,
  initialPhone,
  isSaving,
  onSave,
  onClose,
}: EditSheetProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the fields each time the sheet opens, so a cancelled edit does not
  // persist into the next one.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone(initialPhone);
      setError(null);
    }
  }, [visible, initialName, initialPhone]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter your name.');
      return;
    }
    setError(null);
    onSave(trimmed, phone.trim());
  }, [name, phone, onSave]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      subtitle="Your school sees this name on photos and orders."
      keyboard
      // Two fields fit without it on most phones, but not on a small one with
      // the keyboard up — and `keyboardShouldPersistTaps` comes with it, so a
      // tap on Save while the keyboard is open lands on Save rather than only
      // dismissing the keyboard.
      scroll
      footer={
        <View style={styles.sheetActions}>
          <Button
            variant="outline"
            onPress={onClose}
            disabled={isSaving}
            style={styles.sheetButton}
          >
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            loading={isSaving}
            style={styles.sheetButton}
          >
            Save
          </Button>
        </View>
      }
    >
      <View style={styles.sheetFields}>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={error ?? undefined}
          editable={!isSaving}
        />

        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Optional"
          hint="Your school uses this to reach you about orders."
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={!isSaving}
        />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Contact line
// ---------------------------------------------------------------------------

/**
 * One way to reach this person.
 *
 * **Not a key-value row.** The previous shape was `Email ······ you@x.com`,
 * right-aligned against a fixed 52pt label column, which is how a database
 * record looks and not how a contact card does. An envelope in front of an
 * address needs no word "Email" — the glyph is the label, the address is the
 * content, and dropping the middle column gives the value the whole width it
 * needs before it starts truncating.
 *
 * The glyph carries no accessible name of its own; the line's own text is what
 * gets read, prefixed by `label` so "you@example.com" is not announced bare.
 */
function ContactLine({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View
      style={styles.contactLine}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Ionicons
        name={icon}
        size={18}
        color={colors.text.tertiary}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text
        variant="body"
        color={muted ? colors.text.tertiary : colors.text.primary}
        numberOfLines={1}
        style={styles.contactValue}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * `<ProfileScreen>` — the profile tab, shared by all three roles.
 *
 * The teacher, parent and admin profile screens were three near-identical
 * copies. Making the profile editable in three places would have meant three
 * copies of the edit sheet too, so they now all render this — which means this
 * one file is what a parent, a teacher and a nursery manager each see, and it
 * has to read correctly as all three.
 *
 * It is deliberately a short screen. A profile is somewhere you confirm who you
 * are and occasionally correct a phone number; padding it out with settings
 * rows that lead nowhere would be inventing a console. Role and school are
 * shown but not editable — they decide what the user can see, and the server
 * rejects any attempt to set them here.
 */
export function ProfileScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useAuthStore();
  const updateProfile = useUpdateProfile();

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [editing, setEditing] = useState(false);

  const confirmSignOut = useCallback(async () => {
    setConfirmingSignOut(false);
    await signOut();
    router.replace('/(auth)/login' as never);
  }, [signOut, router]);

  const handleSave = useCallback(
    async (name: string, phone: string) => {
      try {
        await updateProfile.mutateAsync({
          fullName: name,
          // An empty box means "no phone", which the API expresses as null.
          phone: phone === '' ? null : phone,
        });
        setEditing(false);
      } catch {
        // Reported by the hook's onError toast. The sheet stays open so the
        // edit is not silently lost.
      }
    },
    [updateProfile],
  );

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const email = user?.email ?? '';
  const roleLabel = profile?.role ? ROLE_LABEL[profile.role] : null;

  return (
    <ScreenContainer scroll tabBarClearance edges={['top', 'left', 'right']}>
      <HeaderBar large title="Profile" />

      <View style={styles.content}>
        {/* The identity card. The avatar sits on the card's edge rather than
            centred above it, so the name reads as a person on a record instead
            of a social-media header. */}
        <Reveal>
          <Card elevation="raised" padding={spacing.lg}>
            <View style={styles.identityRow}>
              <Avatar uri={profile?.avatar_url} name={displayName} size="lg" />
              <View style={styles.identityText}>
                <Text variant="h3" numberOfLines={2}>
                  {displayName}
                </Text>
                {roleLabel && <Badge variant="neutral">{roleLabel}</Badge>}
              </View>
            </View>

            <Divider style={styles.identityDivider} />

            <ContactLine icon="mail-outline" label="Email" value={email} />
            <ContactLine
              icon="call-outline"
              label="Phone"
              value={profile?.phone ?? 'No phone number yet'}
              muted={!profile?.phone}
            />
          </Card>
        </Reveal>

        <Reveal index={1} style={styles.actions}>
          <Button
            variant="outline"
            fullWidth
            onPress={() => setEditing(true)}
            leftIcon={
              <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            }
            accessibilityHint="Opens a sheet where you can change your name and phone number."
          >
            Edit profile
          </Button>

          {/* Set apart rather than stacked as a peer of Edit: leaving is not
              the other half of a pair of edits. */}
          <Divider style={styles.signOutDivider} />

          <Button
            variant="ghost"
            fullWidth
            onPress={() => setConfirmingSignOut(true)}
          >
            Sign out
          </Button>
        </Reveal>
      </View>

      <EditProfileSheet
        visible={editing}
        initialName={profile?.full_name ?? ''}
        initialPhone={profile?.phone ?? ''}
        isSaving={updateProfile.isPending}
        onSave={handleSave}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        visible={confirmingSignOut}
        title="Sign out"
        message="Sign out of Hive? You will need to sign in again to get back in."
        confirmLabel="Sign out"
        onConfirm={confirmSignOut}
        onCancel={() => setConfirmingSignOut(false)}
      />
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
    paddingTop: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  identityDivider: {
    marginVertical: spacing.md,
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.sm,
  },
  contactValue: {
    flex: 1,
  },
  actions: {
    marginTop: spacing.lg,
  },
  signOutDivider: {
    marginVertical: spacing.md,
  },

  // ── Edit sheet ───────────────────────────────────────────────────────
  sheetFields: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.ms,
  },
  sheetButton: {
    flex: 1,
  },
});

export default ProfileScreen;
