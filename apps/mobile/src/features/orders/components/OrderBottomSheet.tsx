import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { v4 as uuidv4 } from 'uuid';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text, Button, TextInput, Divider } from '@/components/ui';
import { HiveImage } from '@/components/media';
import { Reveal } from '@/components/animation';
import { BottomSheet } from '@/components/feedback';
import type { ProductType } from '@/types/supabase';

import {
  PRODUCT_PRICES_PAISE,
  PRODUCT_LABELS,
  formatRupees,
} from '../constants/products';
import { useCreateOrder } from '../hooks/useOrders';
import { ProductPicker } from './ProductPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderBottomSheetProps {
  /** The photo ID to order. */
  photoId: string;
  /** The photo URI for thumbnail display. */
  photoUri: string;
  /** Whether the bottom sheet is visible. */
  isVisible: boolean;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads from the shared catalogue. This used to hold a second, hand-written
 * copy of the seven labels, which meant renaming a product in `products.ts`
 * changed the picker and not the summary a parent confirmed against.
 */
function getProductLabel(type: ProductType): string {
  return PRODUCT_LABELS[type];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderBottomSheet>` — ordering a print, on one screen.
 *
 * It used to be a three-step wizard: choose, review, confirm, with a named
 * progress rail across the top. A wizard exists to break up a form with
 * genuine unknowns in it — but by the time a parent gets here they are
 * authenticated, and their child, class and school are all already known to the
 * server. **There was nothing to wizard through.** What the three steps
 * actually did was hide the price behind two taps and put the delivery address
 * on a screen the parent reached only after committing.
 *
 * So: one screen. The photograph, the catalogue, how many, where it goes, and
 * the money — in that order, which is the order the questions occur to
 * somebody. Two things follow from collapsing it:
 *
 *  - **The all-in figure is on the button**, in the pinned footer, from the
 *    moment a product is chosen. It is visible without scrolling and it never
 *    changes on the next screen, because there is no next screen.
 *  - **Delivery is stated up front**, under the catalogue, before any choice is
 *    made. A delivery cost that first appears at checkout is the oldest hostile
 *    pattern in commerce; Hive's is included, and saying so is free.
 *
 * Every hook call, the idempotency key, the server-side pricing and the address
 * validation are unchanged — this is a change of shape, not of ordering logic.
 */
export function OrderBottomSheet({
  photoId,
  photoUri,
  isVisible,
  onClose,
}: OrderBottomSheetProps) {
  const createOrder = useCreateOrder();

  // ── Local state ─────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [quantity, setQuantity] = useState(1);
  // Starts empty. This used to pre-fill from `profile.phone`, so every parent
  // with a number on file began the order flow with their phone number sitting
  // in the shipping-address box — and nothing in the profile holds an address
  // to pre-fill it with instead.
  const [shippingAddress, setShippingAddress] = useState('');
  const [addressTouched, setAddressTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleDismiss = useCallback(() => {
    setSelectedType(null);
    setQuantity(1);
    setNotes('');
    // Cleared with the rest of the per-attempt state: the address itself is
    // kept on purpose (a parent orders to the same address twice), but a
    // "touched" flag left over from a previous sheet would show the required
    // error on a fresh order the parent has not typed in.
    setAddressTouched(false);
    setOrderSuccess(false);
    createOrder.reset();
    onClose();
  }, [onClose, createOrder]);

  const handleProductSelect = useCallback((type: ProductType) => {
    setSelectedType(type);
  }, []);

  // ── Quantity stepper ──────────────────────────────────────────────
  const incrementQuantity = useCallback(() => {
    Haptics.selectionAsync();
    setQuantity((q) => Math.min(q + 1, 99));
  }, []);

  const decrementQuantity = useCallback(() => {
    Haptics.selectionAsync();
    setQuantity((q) => Math.max(q - 1, 1));
  }, []);

  // ── Place order ───────────────────────────────────────────────────
  // The server requires a non-empty shipping address. Checking it here turns
  // what was an opaque 400 ("Validation failed") into a field-level error.
  const hasAddress = shippingAddress.trim().length > 0;

  const handlePlaceOrder = useCallback(async () => {
    if (!selectedType) return;

    if (!shippingAddress.trim()) {
      setAddressTouched(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const idempotencyKey = uuidv4();

    createOrder.mutate(
      {
        items: [
          {
            photoId,
            productType: selectedType,
            quantity,
          },
        ],
        shippingAddress: shippingAddress.trim() || null,
        notes: notes.trim() || null,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          // The haptic lands with the confirmation, not with the tap. A Success
          // buzz at request time congratulates the parent on an order the
          // server has not accepted yet — and fires again, wrongly, if it
          // fails.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setOrderSuccess(true);
        },
      },
    );
  }, [selectedType, photoId, quantity, shippingAddress, notes, createOrder]);

  // ── Computed values ────────────────────────────────────────────────
  const unitPrice = selectedType ? PRODUCT_PRICES_PAISE[selectedType] : 0;
  const totalPrice = unitPrice * quantity;
  const canPlace = !!selectedType && hasAddress;

  // ── The order placed ──────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <BottomSheet
        visible={isVisible}
        onClose={handleDismiss}
        // The one place a toast is deliberately swallowed. `useCreateOrder`
        // raises "Order placed successfully" on the way in, and this panel says
        // the same thing better and with the figures — a banner over the top of
        // it is the app congratulating itself twice. Errors keep their outlet
        // on the form below, where the server's own wording is worth reading.
        toastOutlet={false}
        footer={
          <Button variant="primary" fullWidth onPress={handleDismiss}>
            Done
          </Button>
        }
      >
        <View style={styles.successPanel}>
          {/* One quiet mark. There used to be confetti here — forty pieces
              over two and a half seconds, on a screen a parent sees perhaps
              once a term and a teacher saw every working day. */}
          <Reveal scale>
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={34} color={colors.success.main} />
            </View>
          </Reveal>

          <Reveal index={1}>
            <Text variant="h2" center style={styles.successTitle}>
              Order placed.
            </Text>
          </Reveal>

          <Reveal index={2}>
            <Text variant="body" muted center style={styles.successMessage}>
              {quantity} × {selectedType ? getProductLabel(selectedType) : ''} ·{' '}
              {formatRupees(totalPrice)}. Your school will confirm it shortly, and
              you can follow it under Orders.
            </Text>
          </Reveal>
        </View>
      </BottomSheet>
    );
  }

  // ── The order ─────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={isVisible}
      onClose={handleDismiss}
      title="Order a print"
      subtitle="Delivery is included in every price."
      showClose
      scroll
      keyboard
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handlePlaceOrder}
          loading={createOrder.isPending}
          disabled={!canPlace}
          accessibilityHint={
            canPlace
              ? undefined
              : 'Choose what you would like and add a delivery address first'
          }
        >
          {selectedType
            ? `Place order · ${formatRupees(totalPrice)}`
            : 'Place order'}
        </Button>
      }
    >
      {/* The photograph being ordered, mounted the way it will be printed. */}
      <View style={styles.photoRow}>
        <View style={styles.thumbnailMount}>
          <HiveImage
            uri={photoUri}
            recyclingKey={photoId}
            style={styles.thumbnail}
            contentFit="cover"
          />
        </View>
      </View>

      <Text variant="h4" style={styles.question}>
        What would you like?
      </Text>

      {/* The sheet's own subtitle carries the delivery line, pinned above the
          scroll area — so it is stated before any choice is made and stays
          stated, rather than being repeated here as body copy. */}
      <ProductPicker selectedType={selectedType} onSelect={handleProductSelect} />

      {/* How many */}
      <View style={styles.quantityRow}>
        <Text variant="bodyBold">How many?</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={decrementQuantity}
            style={[styles.stepperButton, quantity <= 1 && styles.stepperButtonDisabled]}
            disabled={quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel="One fewer"
          >
            <Ionicons
              name="remove"
              size={19}
              color={quantity <= 1 ? colors.gray[500] : colors.text.primary}
            />
          </Pressable>
          <Text
            variant="bodyBold"
            style={styles.quantityText}
            accessibilityLabel={`Quantity ${quantity}`}
          >
            {quantity}
          </Text>
          <Pressable
            onPress={incrementQuantity}
            style={styles.stepperButton}
            accessibilityRole="button"
            accessibilityLabel="One more"
          >
            <Ionicons name="add" size={19} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Where it goes */}
      <TextInput
        label="Delivery address"
        placeholder="Flat, street, area, city, PIN"
        value={shippingAddress}
        onChangeText={setShippingAddress}
        // The only thing that used to set `addressTouched` was the submit
        // handler — and the button is disabled while the address is empty, so
        // the handler could never run in the one case the message exists for.
        // Marking it touched on blur is what makes the explanation appear, and
        // blur means it never fires at a parent who has not reached the field.
        onBlur={() => setAddressTouched(true)}
        error={
          addressTouched && !hasAddress
            ? 'We need an address to send the prints to.'
            : undefined
        }
        multiline
        containerStyle={styles.input}
      />

      <TextInput
        label="Notes for the school"
        placeholder="Anything they should know? (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        containerStyle={styles.input}
      />

      {/* The money, in full, before the button is ever pressed. */}
      {selectedType && (
        <View style={styles.recap}>
          <View style={styles.recapRow}>
            <Text variant="bodySmall" muted>
              {getProductLabel(selectedType)} × {quantity}
            </Text>
            <Text variant="bodySmall">{formatRupees(totalPrice)}</Text>
          </View>
          <View style={styles.recapRow}>
            <Text variant="bodySmall" muted>
              Delivery
            </Text>
            <Text variant="bodySmall">Included</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.recapRow}>
            <Text variant="bodyBold">Total</Text>
            <Text variant="price">{formatRupees(totalPrice)}</Text>
          </View>
        </View>
      )}

      {createOrder.isError && (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={17} color={colors.error.main} />
          <Text variant="bodySmall" color={colors.error.main} style={styles.errorText}>
            We couldn&apos;t place the order. Check your connection and try again.
          </Text>
        </View>
      )}

      <View style={styles.bodyFoot} />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ── The photograph ──
  photoRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  thumbnailMount: {
    padding: spacing.xs + 2,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
    ...platformShadow(shadows.small),
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: radius.print,
  },

  // ── The catalogue ──
  question: {
    marginBottom: spacing.ms,
  },

  // ── Quantity ──
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.surfaceSecondary,
  },
  stepperButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    minWidth: 28,
    textAlign: 'center',
  },

  // ── Address and notes ──
  input: {
    marginTop: spacing.md,
  },

  // ── The money ──
  recap: {
    marginTop: spacing.lg,
    backgroundColor: colors.background.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    marginVertical: spacing.xxs,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.ms,
    borderRadius: radius.lg,
    backgroundColor: colors.error.background,
  },
  errorText: {
    flex: 1,
  },

  /** Keeps the last field clear of the pinned footer while scrolling. */
  bodyFoot: {
    height: spacing.lg,
  },

  // ── The order placed ──
  successPanel: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  checkmark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    marginBottom: spacing.sm,
  },
  successMessage: {
    maxWidth: 320,
  },
});

export default OrderBottomSheet;
