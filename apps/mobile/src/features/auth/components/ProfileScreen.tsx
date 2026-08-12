import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout } from '@/theme';
import { Text, Button, Avatar, TextInput, Card, Badge, Divider } from '@/components/ui';
import { Reveal } from '@/components/animation';
import { ScreenContainer, KeyboardAvoid } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { ConfirmDialog, Modal } from '@/components/feedback';
import { useAuthStore } from '../stores/authStore';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

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
  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone(initialPhone);
      setError(null);
    }
  }, [visible, initialName, initialPhone]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter your name.');
      return;
    }
    setError(null);
    onSave(trimmed, phone.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoid>
            <View style={styles.handleIndicator} />
            <View style={styles.sheetContent}>
              <Text variant="h3" style={styles.sheetTitle}>
                Edit profile
              </Text>

              <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                error={error ?? undefined}
              />

              <TextInput
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="Optional"
                hint="Your school uses this to reach you about orders."
                keyboardType="phone-pad"
              />

              <View style={styles.sheetActions}>
                <Button variant="outline" onPress={onClose} style={styles.sheetButton}>
                  Cancel
                </Button>
                <Button onPress={handleSave} loading={isSaving} style={styles.sheetButton}>
                  Save
                </Button>
              </View>
            </View>
          </KeyboardAvoid>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail row
// ---------------------------------------------------------------------------

function DetailRow({
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
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color={colors.text.tertiary} />
      <Text variant="bodySmall" color={colors.text.tertiary} style={styles.detailLabel}>
        {label}
      </Text>
      <Text
        variant="bodySmallBold"
        color={muted ? colors.text.tertiary : colors.text.primary}
        numberOfLines={1}
        style={styles.detailValue}
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
 * copies of the edit sheet too, so they now all render this.
 *
 * Role and school are shown but not editable: they decide what the user can
 * see, and the server rejects any attempt to set them here.
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

  const roleLabel = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : null;

  return (
    <ScreenContainer scroll tabBarClearance edges={['top', 'left', 'right']}>
      <HeaderBar large title="Profile" />

      <View style={styles.content}>
        {/* Identity card. The avatar sits on the card's edge rather than
            centred above it, so the name reads as a label on a record instead
            of a social-media header. */}
        <Reveal>
          <Card elevation="raised" padding={spacing.lg} style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Avatar uri={profile?.avatar_url} name={displayName} size="lg" />
              <View style={styles.identityText}>
                <Text variant="h3" numberOfLines={1}>
                  {displayName}
                </Text>
                {roleLabel && (
                  <Badge
                    variant="default"
                    style={styles.roleBadge}
                  >
                    {roleLabel}
                  </Badge>
                )}
              </View>
            </View>

            <Divider style={styles.identityDivider} />

            <DetailRow icon="mail-outline" label="Email" value={email} />
            <DetailRow
              icon="call-outline"
              label="Phone"
              value={profile?.phone ?? 'Not added'}
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
          >
            Edit profile
          </Button>

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
  identityCard: {},
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
  roleBadge: {},
  identityDivider: {
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    width: 52,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.ms,
  },

  // Edit sheet
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.border.default,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.ms,
    marginBottom: spacing.sm,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  sheetTitle: {
    marginBottom: spacing.xs,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.ms,
    marginTop: spacing.md,
  },
  sheetButton: {
    flex: 1,
  },
});

export default ProfileScreen;
