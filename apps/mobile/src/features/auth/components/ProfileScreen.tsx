import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text, Button, Avatar, TextInput } from '@/components/ui';
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
      setError('Name cannot be empty');
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

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Profile" />
      <View style={styles.content}>
        <Avatar
          uri={profile?.avatar_url}
          name={displayName}
          size="lg"
          style={styles.avatar}
        />
        <Text variant="h3" style={styles.name}>
          {displayName}
        </Text>
        <Text variant="body" color={colors.text.secondary} style={styles.email}>
          {email}
        </Text>
        {profile?.phone && (
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.phone}>
            {profile.phone}
          </Text>
        )}
        {profile?.role && (
          <View style={styles.roleBadge}>
            <Text variant="caption" color={colors.primary.amberDark}>
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </Text>
          </View>
        )}

        <Button
          variant="outline"
          size="lg"
          onPress={() => setEditing(true)}
          leftIcon={
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
          }
          style={styles.action}
        >
          Edit profile
        </Button>

        <Button
          variant="outline"
          size="lg"
          onPress={() => setConfirmingSignOut(true)}
          style={styles.action}
        >
          Sign out
        </Button>
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  avatar: {
    marginBottom: spacing.md,
  },
  name: {
    marginBottom: spacing.xs,
  },
  email: {
    marginBottom: spacing.xs,
  },
  phone: {
    marginBottom: spacing.sm,
  },
  roleBadge: {
    backgroundColor: colors.primary.amberLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: layout.buttonRadius,
    marginBottom: spacing.xxl,
  },
  action: {
    width: '100%',
    maxWidth: 280,
    borderRadius: layout.buttonRadius,
    marginBottom: spacing.sm,
  },

  // Edit sheet
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.lg,
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.gray[300],
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  sheetTitle: {
    marginBottom: spacing.xs,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sheetButton: {
    flex: 1,
  },
});

export default ProfileScreen;
