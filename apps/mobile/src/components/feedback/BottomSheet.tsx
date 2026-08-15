import React, { type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  duration,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { KeyboardAvoid } from '@/components/layout/KeyboardAvoid';

import { Modal } from './Modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BottomSheetProps {
  /** Whether the sheet is open. */
  visible: boolean;
  /** Called on backdrop press, the close button, and Android back. */
  onClose: () => void;

  /** Title, set in the display face at the top of the sheet. */
  title?: string;
  /** A small uppercase mark above the title. */
  eyebrow?: string;
  /** A quiet line under the title. */
  subtitle?: string;

  /**
   * Shows an ✕ at the trailing edge of the header. Worth it when the sheet is
   * tall enough that the backdrop is out of comfortable thumb reach.
   * @default false
   */
  showClose?: boolean;

  /** Puts the body in a `ScrollView`. @default false */
  scroll?: boolean;
  /** Lifts the sheet above the keyboard. @default false */
  keyboard?: boolean;

  /**
   * How tall the sheet may grow, as a fraction of the window.
   *
   * The default is the house policy and should almost always be left alone —
   * the app previously had four different ceilings across fourteen sheets.
   * `full` is for sheets that own the screen while open, like the tagger.
   */
  height?: 'auto' | 'full';

  /**
   * Pinned to the bottom, outside the scroll area — for the primary action, so
   * it stays reachable while the body scrolls.
   */
  footer?: ReactNode;

  /** Set false where a toast would be intrusive. @default true */
  toastOutlet?: boolean;

  /** Extra style for the body region. */
  contentStyle?: StyleProp<ViewStyle>;

  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The single height policy. Leaves the top of the screen visible so the sheet
 * still reads as a layer over the page rather than a new screen.
 */
const MAX_HEIGHT_RATIO = 0.88;
const FULL_HEIGHT_RATIO = 0.94;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<BottomSheet>` — the app's one sheet.
 *
 * Every modal surface in Hive is this component. It owns the scrim, the corner
 * radius, the grab handle, the safe-area inset, the keyboard inset and the
 * height ceiling, so that fourteen sheets stop each having their own opinion
 * about all six.
 *
 * It renders through `@/components/feedback/Modal`, which carries the
 * `ToastOutlet` — RN's `Modal` is a separate native window, so a toast raised
 * from inside a sheet is invisible without it.
 *
 * ```tsx
 * <BottomSheet
 *   visible={isOpen}
 *   onClose={close}
 *   eyebrow="Step 2 of 3"
 *   title="Who is in them?"
 *   scroll
 *   footer={<Button fullWidth onPress={submit}>Share</Button>}
 * >
 *   …
 * </BottomSheet>
 * ```
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  eyebrow,
  subtitle,
  showClose = false,
  scroll = false,
  keyboard = false,
  height = 'auto',
  footer,
  toastOutlet = true,
  contentStyle,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const ratio = height === 'full' ? FULL_HEIGHT_RATIO : MAX_HEIGHT_RATIO;
  const maxHeight = windowHeight * ratio;

  const hasHeader = Boolean(title || eyebrow || subtitle || showClose);

  // The grab handle is decorative — the sheet is dismissed by the backdrop, the
  // close button or the hardware back button, so it must not absorb a tap that
  // was aimed at the content behind it.
  const body = (
    <View style={[styles.body, contentStyle]}>{children}</View>
  );

  const sheet = (
    // A plain View: with the backdrop as a sibling rather than an ancestor,
    // a tap on the sheet has nothing to bubble into, so there is nothing to
    // swallow — and one fewer pressable wrapped around everything.
    <View
      style={[
        styles.sheet,
        { maxHeight },
        height === 'full' && { height: maxHeight },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.handle} />

      {hasHeader && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow && (
              <Text variant="eyebrow" color={colors.text.tertiary}>
                {eyebrow}
              </Text>
            )}
            {title && (
              <Text variant="h3" style={eyebrow ? styles.titleUnderEyebrow : undefined}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text variant="bodySmall" muted style={styles.subtitle}>
                {subtitle}
              </Text>
            )}
          </View>

          {showClose && (
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          )}
        </View>
      )}

      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}

      {footer && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {footer}
        </View>
      )}

      {/* Without a footer the sheet still owes the home indicator its space. */}
      {!footer && <View style={{ height: Math.max(insets.bottom, spacing.md) }} />}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      toastOutlet={toastOutlet}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(duration.fast)}
        exiting={FadeOut.duration(duration.instant)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <View style={styles.scrim} />
      </Animated.View>

      {/*
        The backdrop is a sibling of the sheet, not its parent.

        It began as a wrapper, which is the obvious way to write it and is
        wrong: the sheet rendered *inside* the dismiss target, so every control
        in the sheet was a button nested inside a button. On web that is
        invalid HTML; on native a screen reader announces the whole sheet as
        one enormous "Close" button and the rows inside stop being reachable as
        themselves.

        As a sibling it can be hidden from assistive technology without taking
        the sheet with it — a screen reader user dismisses with the close
        button or the back gesture, and never has to find an unlabelled region
        of screen to tap.
      */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={styles.backdrop} pointerEvents="box-none">
        {keyboard ? <KeyboardAvoid>{sheet}</KeyboardAvoid> : sheet}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.raised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...platformShadow(shadows.xlarge),
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.default,
    marginTop: spacing.ms,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.ms,
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  titleUnderEyebrow: {
    marginTop: spacing.xxs,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  closeButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.ms,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.raised,
  },
});

export default BottomSheet;
