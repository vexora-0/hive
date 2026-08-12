import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { v4 as uuidv4 } from 'uuid';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { Text, Button, TextInput, Divider } from '@/components/ui';
import { HiveImage } from '@/components/media';
import { ConfettiOverlay } from '@/components/animation';
import type { ProductType } from '@/types/supabase';

import {
  PRODUCT_PRICES_PAISE,
  PRODUCT_LABELS,
  formatRupees,
} from '../constants/products';
import { useCreateOrder } from '../hooks/useOrders';
import { ProductPicker } from './ProductPicker';
import { Modal } from '@/components/feedback';

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

type Step = 'product' | 'summary' | 'confirm';

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

/** The three steps, in order, with the name shown while you are on it. */
const STEPS: { key: Step; label: string }[] = [
  { key: 'product', label: 'Choose' },
  { key: 'summary', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderBottomSheet>` — a 3-step bottom sheet flow for placing an order.
 *
 * Step 1: Select a product type via ProductPicker.
 * Step 2: Review order summary with quantity stepper.
 * Step 3: Enter shipping address and confirm the order.
 */
export function OrderBottomSheet({
  photoId,
  photoUri,
  isVisible,
  onClose,
}: OrderBottomSheetProps) {
  const createOrder = useCreateOrder();

  // ── Local state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('product');
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
    setStep('product');
    setSelectedType(null);
    setQuantity(1);
    setNotes('');
    // Cleared with the rest of the per-attempt state: the address itself is
    // kept on purpose (a parent orders to the same address twice), but a
    // "touched" flag left over from a previous sheet would show the required
    // error on the confirm step of a fresh order the parent has not typed in.
    setAddressTouched(false);
    setOrderSuccess(false);
    createOrder.reset();
    onClose();
  }, [onClose, createOrder]);

  // ── Step navigation ────────────────────────────────────────────────
  const handleProductSelect = useCallback((type: ProductType) => {
    setSelectedType(type);
  }, []);

  const goToSummary = useCallback(() => {
    if (!selectedType) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('summary');
  }, [selectedType]);

  const goToConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('confirm');
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => {
      if (prev === 'confirm') return 'summary';
      if (prev === 'summary') return 'product';
      return prev;
    });
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

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
          setOrderSuccess(true);
        },
      },
    );
  }, [selectedType, photoId, quantity, shippingAddress, notes, createOrder]);

  // ── Computed values ────────────────────────────────────────────────
  const unitPrice = selectedType ? PRODUCT_PRICES_PAISE[selectedType] : 0;
  const totalPrice = unitPrice * quantity;

  // ── Render helpers ─────────────────────────────────────────────────

  // A named rail rather than three dots: "Review" tells a parent where they
  // are and what is left, which a row of circles cannot.
  const renderStepIndicator = () => {
    const activeIndex = STEPS.findIndex((s) => s.key === step);

    return (
      <View
        style={styles.stepIndicator}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${activeIndex + 1} of ${STEPS.length}: ${STEPS[activeIndex]?.label}`}
      >
        {STEPS.map((s, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <View key={s.key} style={styles.stepItem}>
              <View
                style={[
                  styles.stepBar,
                  isDone && styles.stepBarDone,
                  isActive && styles.stepBarActive,
                ]}
              />
              <Text
                variant="tiny"
                color={
                  isActive
                    ? colors.text.accent
                    : isDone
                      ? colors.text.secondary
                      : colors.text.tertiary
                }
              >
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderProductStep = () => (
    <View style={styles.stepContent}>
      <Text variant="h3">What would you like?</Text>
      <Text variant="bodySmall" muted style={styles.subtitle}>
        Pick one to start. You can order more later.
      </Text>
      <ProductPicker selectedType={selectedType} onSelect={handleProductSelect} />
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={goToSummary}
        disabled={!selectedType}
        style={styles.ctaButton}
      >
        Continue
      </Button>
    </View>
  );

  const renderSummaryStep = () => (
    <View style={styles.stepContent}>
      <Pressable
        onPress={goBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Back to product choice"
      >
        <Ionicons name="chevron-back" size={16} color={colors.text.accent} />
        <Text variant="bodySmallBold" color={colors.text.accent}>
          Back
        </Text>
      </Pressable>

      <Text variant="h3">Your order</Text>

      {/* The photo is shown mounted, the way it will be printed. */}
      <View style={styles.summaryRow}>
        <View style={styles.thumbnailMount}>
          <HiveImage uri={photoUri} style={styles.thumbnail} />
        </View>
        <View style={styles.summaryDetails}>
          <Text variant="bodyBold">
            {selectedType ? getProductLabel(selectedType) : ''}
          </Text>
          <Text variant="bodySmall" muted>
            {formatRupees(unitPrice)} each
          </Text>
        </View>
      </View>

      {/* Quantity stepper */}
      <View style={styles.quantityRow}>
        <Text variant="bodyBold">Quantity</Text>
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
              color={quantity <= 1 ? colors.gray[400] : colors.text.primary}
            />
          </Pressable>
          <Text variant="bodyBold" style={styles.quantityText}>
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

      {/* Total */}
      <View style={styles.totalRow}>
        <Text variant="bodyBold">Total</Text>
        <MotiView
          key={totalPrice}
          from={{ scale: 0.94, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 13, stiffness: 240 }}
        >
          <Text variant="priceLarge">{formatRupees(totalPrice)}</Text>
        </MotiView>
      </View>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={goToConfirm}
        style={styles.ctaButton}
      >
        Continue
      </Button>
    </View>
  );

  const renderConfirmStep = () => {
    // Success state
    if (orderSuccess) {
      return (
        <View style={styles.successContainer}>
          <ConfettiOverlay trigger={orderSuccess} />
          <MotiView
            from={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            style={styles.checkmarkCircle}
          >
            <Ionicons name="checkmark" size={38} color={colors.success.dark} />
          </MotiView>
          <Text variant="h2" center style={styles.successTitle}>
            Order placed
          </Text>
          <Text variant="body" muted center style={styles.successMessage}>
            {formatRupees(totalPrice)} · {quantity} ×{' '}
            {selectedType ? getProductLabel(selectedType) : ''}. Your school will
            confirm it shortly, and you can follow it under Orders.
          </Text>
          <Button variant="primary" size="md" fullWidth onPress={handleDismiss}>
            Done
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to the order summary"
        >
          <Ionicons name="chevron-back" size={16} color={colors.text.accent} />
          <Text variant="bodySmallBold" color={colors.text.accent}>
            Back
          </Text>
        </Pressable>

        <Text variant="h3">Where should it go?</Text>

        <TextInput
          label="Delivery address"
          placeholder="Flat, street, area, city, PIN"
          value={shippingAddress}
          onChangeText={setShippingAddress}
          // The only thing that used to set `addressTouched` was the submit
          // handler — and "Place Order" is disabled while the address is
          // empty, so the handler could never run in the one case the message
          // exists for. The error was unreachable: a parent who left the field
          // blank got a greyed-out button and no stated reason. Marking it
          // touched on blur is what makes the explanation appear, and blur
          // means it never fires at a parent who has not reached the field.
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

        {/* Order recap */}
        <View style={styles.recapCard}>
          <View style={styles.recapRow}>
            <Text variant="bodySmall" muted>
              {selectedType ? getProductLabel(selectedType) : ''} × {quantity}
            </Text>
            <Text variant="bodySmallBold">{formatRupees(totalPrice)}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.recapRow}>
            <Text variant="bodyBold">Total</Text>
            <Text variant="price">{formatRupees(totalPrice)}</Text>
          </View>
        </View>

        {createOrder.isError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={17} color={colors.error.dark} />
            <Text variant="bodySmall" color={colors.error.dark} style={styles.errorText}>
              We couldn't place the order. Check your connection and try again.
            </Text>
          </View>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handlePlaceOrder}
          loading={createOrder.isPending}
          disabled={!hasAddress}
          style={styles.ctaButton}
        >
          {`Place order · ${formatRupees(totalPrice)}`}
        </Button>
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────────────
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleIndicatorBar} />
          {!orderSuccess && renderStepIndicator()}
          {/* Scrollable: the confirm step's two multiline fields plus the
              keyboard exceed the sheet's 88% ceiling on a small phone, and
              without this the Place order button is unreachable. */}
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'product' && renderProductStep()}
            {step === 'summary' && renderSummaryStep()}
            {step === 'confirm' && renderConfirmStep()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...platformShadow(shadows.xlarge),
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handleIndicatorBar: {
    alignSelf: 'center',
    backgroundColor: colors.border.default,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.ms,
    marginBottom: spacing.md,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  stepItem: {
    flex: 1,
    gap: spacing.sm,
  },
  stepBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border.light,
  },
  stepBarDone: {
    backgroundColor: colors.primary.amberLight,
  },
  stepBarActive: {
    backgroundColor: colors.primary.amber,
  },

  // Step content
  stepContent: {},
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  ctaButton: {
    marginTop: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginLeft: -spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 36,
  },

  // Summary step
  summaryRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  thumbnailMount: {
    padding: spacing.xs + 2,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
    ...platformShadow(shadows.small),
  },
  thumbnail: {
    width: 76,
    height: 76,
    borderRadius: radius.print,
  },
  summaryDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  // Confirm step
  input: {
    marginTop: spacing.md,
  },
  recapCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.background.surface,
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
    marginVertical: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.ms,
    borderRadius: radius.sm,
    backgroundColor: colors.error.background,
  },
  errorText: {
    flex: 1,
  },

  // Success state
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    marginBottom: spacing.sm,
  },
  successMessage: {
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
});

export default OrderBottomSheet;
