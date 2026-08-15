import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  radius,
  layout,
  shadows,
  platformShadow,
  duration,
  easing,
  useReducedMotion,
} from '@/theme';
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

/**
 * Toasts are ink slabs with a coloured icon, not coloured slabs. A full-width
 * green or red bar reads as an alert banner and pulls the eye off whatever the
 * person was doing; the status belongs in the icon, and the toast belongs in
 * the same material as the tab bar it sits above.
 *
 * The glyph differs before the colour does — a tick, a warning, an i — so the
 * status survives being read in greyscale or by someone who cannot separate the
 * three hues. Colour is the second channel here, never the only one.
 *
 * **Info is peacock, not marigold.** Marigold is the app's single voice and it
 * is spent on the thing the person is meant to act on. An informational toast
 * is the least consequential surface in the app; letting it wear the accent
 * would make the accent mean nothing.
 */
const VARIANT: Record<
  ToastVariant,
  { icon: keyof typeof Ionicons.glyphMap; tint: string; dwell: number }
> = {
  success: { icon: 'checkmark-circle', tint: colors.success.light, dwell: 3000 },
  // An error has to be read, and often re-read, before it can be acted on.
  error: { icon: 'alert-circle', tint: colors.error.light, dwell: 5000 },
  info: { icon: 'information-circle', tint: colors.info.light, dwell: 3000 },
};

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

  /** The pending auto-dismiss, cancelled when a newer toast replaces it. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = Date.now();
    setToast({ id, message, variant });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Only clear if this toast is still the visible one — a newer toast
      // during the window must not be dismissed early.
      setToast((current) => (current?.id === id ? null : current));
    }, VARIANT[variant].dwell);
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

/**
 * The slab itself.
 *
 * A toast is something the app decided, not something a finger caused, so it
 * arrives on a timing curve rather than a spring: an unprompted overshoot on
 * the edge of vision reads as a glitch.
 *
 * **It leaves on a cut, and that is not an oversight.** The outlet unmounts the
 * view the moment the toast clears, and Moti only runs an `exit` prop for a
 * child of `<AnimatePresence>` — so the `exit` that used to be declared here
 * never once ran, in any build. Rather than leave a prop that describes
 * behaviour the app does not have, it is gone: nothing in this component is
 * carried *only* by its departure, and Reduce Motion omits exit animations
 * outright, so anything said on the way out is already unsaid for the people
 * who most need it stated. If a fade-out is wanted later it is an
 * `<AnimatePresence>` around this view and `exitTransition={exitTiming()}` —
 * worth doing on a device where it can be watched, not blind.
 */
function ToastView({ toast, placement, onDismiss }: ToastViewProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  if (!toast) return null;

  const offset =
    placement === 'bottom'
      ? // Above the floating tab bar, clear of the home indicator.
        { bottom: insets.bottom + layout.tabBarHeight + spacing.lg }
      : // Inside a sheet there is no tab bar and the sheet owns the bottom of
        // the screen, so the toast goes to the top. Android dialogs already
        // start below the status bar — nothing here sets statusBarTranslucent —
        // so adding the inset there would double-count it.
        { top: Platform.OS === 'ios' ? insets.top + spacing.sm : spacing.md };

  const variant = VARIANT[toast.variant];

  // Reduce Motion keeps the toast and drops the travel: the message is the
  // point, the slide is not.
  const travelY = reduced ? 0 : placement === 'bottom' ? 20 : -20;
  const restingScale = reduced ? 1 : 0.97;

  return (
    <MotiView
      key={toast.id}
      from={{ opacity: 0, translateY: travelY, scale: restingScale }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: duration.base, easing: easing.standard }}
      style={[styles.container, offset]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel={toast.message}
        accessibilityHint="Dismisses this message"
        // Android has no notion of an alert role; a live region is how the
        // same announcement is made there.
        accessibilityLiveRegion={toast.variant === 'error' ? 'assertive' : 'polite'}
        style={styles.toast}
      >
        <Ionicons name={variant.icon} size={20} color={variant.tint} />
        <View style={styles.textWrap}>
          <Text variant="bodySmallBold" onInk numberOfLines={3}>
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
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.large),
  },
  textWrap: { flex: 1 },
});
