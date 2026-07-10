import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, shadows, ANIMATION_DURATION } from '@/theme';
import { Text } from '@/components/ui';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT: Record<ToastVariant, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: colors.success.main, icon: 'checkmark-circle' },
  error: { bg: colors.error.main, icon: 'alert-circle' },
  info: { bg: colors.info.main, icon: 'information-circle' },
};

const VISIBLE_MS = 3000;

/**
 * Global toast feedback.
 *
 * Outside the upload flow's confetti the app gave no feedback at all — a parent
 * placing an order or an admin changing a role saw nothing happen, success or
 * failure. Order failures in particular were completely silent.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = Date.now();
    setToast({ id, message, variant });
    setTimeout(() => {
      // Only clear if this toast is still the visible one — a newer toast
      // during the window must not be dismissed early.
      setToast((current) => (current?.id === id ? null : current));
    }, VISIBLE_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <MotiView
          key={toast.id}
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 24 }}
          transition={{ type: 'timing', duration: ANIMATION_DURATION }}
          // Sits above the tab bar, clear of the home indicator.
          style={[styles.container, { bottom: insets.bottom + spacing.xxl + spacing.lg }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => setToast(null)}
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            style={[styles.toast, { backgroundColor: VARIANT[toast.variant].bg }]}
          >
            <Ionicons name={VARIANT[toast.variant].icon} size={20} color={colors.white} />
            <View style={styles.textWrap}>
              <Text variant="bodySmallBold" color={colors.white} numberOfLines={3}>
                {toast.message}
              </Text>
            </View>
          </Pressable>
        </MotiView>
      )}
    </ToastContext.Provider>
  );
}

/** Throws if used outside the provider — a silent no-op would hide the bug. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: spacing.md, right: spacing.md },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.cardRadius,
    ...shadows.medium,
  },
  textWrap: { flex: 1 },
});
