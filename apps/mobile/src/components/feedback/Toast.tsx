import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, shadows, ANIMATION_DURATION } from '@/theme';
import { Text } from '@/components/ui';

type ToastVariant = 'success' | 'error' | 'info';
type Placement = 'top' | 'bottom';

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

/** Internal wiring for outlets. Not exported to callers. */
interface ToastInternal {
  toast: ToastState | null;
  dismiss: () => void;
  /** Registers a mounted outlet. Returns its unregister. */
  registerOutlet: () => () => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastInternalContext = createContext<ToastInternal | null>(null);

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
 *
 * The provider owns the state; the visual is rendered by `ToastOutlet`. That
 * split exists because React Native's `Modal` renders into a **separate native
 * window** — a presented view controller on iOS, a Dialog on Android — so a
 * toast mounted here at the React root is covered by any open sheet. Since
 * every sheet in this app is a `Modal`, the error path was still invisible in
 * exactly the flows it was built for. `components/feedback/Modal.tsx` mounts an
 * outlet inside each one.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  // Number of modal-hosted outlets currently mounted. While any is up the root
  // copy stays hidden, or it would show through the sheet's dimmed backdrop.
  const [outletCount, setOutletCount] = useState(0);

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = Date.now();
    setToast({ id, message, variant });
    setTimeout(() => {
      // Only clear if this toast is still the visible one — a newer toast
      // during the window must not be dismissed early.
      setToast((current) => (current?.id === id ? null : current));
    }, VISIBLE_MS);
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  const registerOutlet = useCallback(() => {
    setOutletCount((n) => n + 1);
    return () => setOutletCount((n) => n - 1);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  const internal = useMemo<ToastInternal>(
    () => ({ toast, dismiss, registerOutlet }),
    [toast, dismiss, registerOutlet],
  );

  return (
    <ToastContext.Provider value={api}>
      <ToastInternalContext.Provider value={internal}>
        {children}
        {outletCount === 0 && (
          <ToastView toast={toast} placement="bottom" onDismiss={dismiss} />
        )}
      </ToastInternalContext.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Renders the current toast inside whichever native window it is mounted in.
 *
 * Every mounted outlet renders — there is deliberately no "which window is on
 * top" bookkeeping. The outlets are geometrically identical, so with two modals
 * stacked the upper window's copy sits exactly over the lower one and only one
 * toast is ever seen. That also stays correct when a modal fails to present at
 * all, which a topmost-window registry could not.
 */
export function ToastOutlet({ placement = 'top' }: { placement?: Placement }) {
  const internal = useContext(ToastInternalContext);
  const register = internal?.registerOutlet;

  useEffect(() => register?.(), [register]);

  if (!internal) return null;
  return (
    <ToastView
      toast={internal.toast}
      placement={placement}
      onDismiss={internal.dismiss}
    />
  );
}

interface ToastViewProps {
  toast: ToastState | null;
  placement: Placement;
  onDismiss: () => void;
}

function ToastView({ toast, placement, onDismiss }: ToastViewProps) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  const offset =
    placement === 'bottom'
      ? // Above the tab bar, clear of the home indicator.
        { bottom: insets.bottom + spacing.xxl + spacing.lg }
      : // Inside a sheet there is no tab bar and the sheet owns the bottom of
        // the screen, so the toast goes to the top. Android dialogs already
        // start below the status bar — nothing here sets statusBarTranslucent —
        // so adding the inset there would double-count it.
        { top: Platform.OS === 'ios' ? insets.top + spacing.sm : spacing.md };

  return (
    <MotiView
      key={toast.id}
      from={{ opacity: 0, translateY: placement === 'bottom' ? 24 : -24 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: placement === 'bottom' ? 24 : -24 }}
      transition={{ type: 'timing', duration: ANIMATION_DURATION }}
      style={[styles.container, offset]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
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
