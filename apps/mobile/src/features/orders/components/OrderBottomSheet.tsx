import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { v4 as uuidv4 } from 'uuid';

import { colors, spacing, layout } from '@/theme';
import { Text, Button } from '@/components/ui';
import { TextInput } from '@/components/ui';
import { HiveImage } from '@/components/media';
import type { ProductType } from '@/types/supabase';
import { useAuthStore } from '@/features/auth/stores/authStore';

import { PRODUCT_PRICES_CENTS, formatCents } from '../constants/products';
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

type Step = 'product' | 'summary' | 'confirm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



function getProductLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    print_4x6: '4x6 Print',
    print_5x7: '5x7 Print',
    print_8x10: '8x10 Print',
    digital_download: 'Digital Download',
    photo_book: 'Photo Book',
    magnet: 'Magnet',
    mug: 'Mug',
  };
  return labels[type];
}

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
  const profile = useAuthStore((s) => s.profile);
  const createOrder = useCreateOrder();

  // ── Local state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('product');
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [shippingAddress, setShippingAddress] = useState(
    profile?.phone ?? '', // pre-fill if available
  );
  const [notes, setNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleDismiss = useCallback(() => {
    setStep('product');
    setSelectedType(null);
    setQuantity(1);
    setNotes('');
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
  const handlePlaceOrder = useCallback(async () => {
    if (!selectedType) return;

    const idempotencyKey = uuidv4();
    const unitPrice = PRODUCT_PRICES_CENTS[selectedType];

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
  const unitPrice = selectedType ? PRODUCT_PRICES_CENTS[selectedType] : 0;
  const totalPrice = unitPrice * quantity;

  // ── Render helpers ─────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {(['product', 'summary', 'confirm'] as Step[]).map((s, index) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            step === s && styles.stepDotActive,
            (['product', 'summary', 'confirm'] as Step[]).indexOf(step) > index &&
              styles.stepDotCompleted,
          ]}
        />
      ))}
    </View>
  );

  const renderProductStep = () => (
    <View style={styles.stepContent}>
      <Text variant="h3">Choose a Product</Text>
      <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
        Select how you would like this photo
      </Text>
      <ProductPicker selectedType={selectedType} onSelect={handleProductSelect} />
      <Button
        variant="primary"
        size="lg"
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
      <Pressable onPress={goBack} style={styles.backButton}>
        <Text variant="bodySmallBold" color={colors.primary.amber}>
          Back
        </Text>
      </Pressable>

      <Text variant="h3">Order Summary</Text>

      <View style={styles.summaryRow}>
        <HiveImage
          uri={photoUri}
          style={styles.thumbnail}
        />
        <View style={styles.summaryDetails}>
          <Text variant="bodyBold">
            {selectedType ? getProductLabel(selectedType) : ''}
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary}>
            {formatCents(unitPrice)} each
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
            accessibilityLabel="Decrease quantity"
          >
            <Text
              variant="h4"
              color={quantity <= 1 ? colors.gray[400] : colors.text.primary}
              center
            >
              -
            </Text>
          </Pressable>
          <Text variant="bodyBold" style={styles.quantityText}>
            {quantity}
          </Text>
          <Pressable
            onPress={incrementQuantity}
            style={styles.stepperButton}
            accessibilityLabel="Increase quantity"
          >
            <Text variant="h4" center>
              +
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text variant="bodyBold">Total</Text>
        <Text variant="h3" color={colors.primary.amberDark}>
          {formatCents(totalPrice)}
        </Text>
      </View>

      <Button
        variant="primary"
        size="lg"
        onPress={goToConfirm}
        style={styles.ctaButton}
      >
        Continue to Checkout
      </Button>
    </View>
  );

  const renderConfirmStep = () => {
    // Success state
    if (orderSuccess) {
      return (
        <View style={styles.successContainer}>
          <View style={styles.checkmarkCircle}>
            <Text variant="h1" center>
              {'✓'}
            </Text>
          </View>
          <Text variant="h3" center style={styles.successTitle}>
            Order Placed!
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            center
            style={styles.successMessage}
          >
            Your order has been submitted successfully. You will receive a
            confirmation shortly.
          </Text>
          <Button
            variant="primary"
            size="md"
            onPress={handleDismiss}
            style={styles.ctaButton}
          >
            Done
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Text variant="bodySmallBold" color={colors.primary.amber}>
            Back
          </Text>
        </Pressable>

        <Text variant="h3">Confirm Order</Text>

        <TextInput
          label="Shipping Address"
          placeholder="Enter your shipping address"
          value={shippingAddress}
          onChangeText={setShippingAddress}
          multiline
          containerStyle={styles.input}
        />

        <TextInput
          label="Notes (optional)"
          placeholder="Any special instructions?"
          value={notes}
          onChangeText={setNotes}
          multiline
          containerStyle={styles.input}
        />

        {/* Order recap */}
        <View style={styles.recapCard}>
          <View style={styles.recapRow}>
            <Text variant="bodySmall" color={colors.text.secondary}>
              Product
            </Text>
            <Text variant="bodySmallBold">
              {selectedType ? getProductLabel(selectedType) : ''}
            </Text>
          </View>
          <View style={styles.recapRow}>
            <Text variant="bodySmall" color={colors.text.secondary}>
              Quantity
            </Text>
            <Text variant="bodySmallBold">{quantity}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.recapRow}>
            <Text variant="bodyBold">Total</Text>
            <Text variant="h4" color={colors.primary.amberDark}>
              {formatCents(totalPrice)}
            </Text>
          </View>
        </View>

        {createOrder.isError && (
          <Text variant="bodySmall" color={colors.error.main} style={styles.errorText}>
            Failed to place order. Please try again.
          </Text>
        )}

        <Button
          variant="primary"
          size="lg"
          onPress={handlePlaceOrder}
          loading={createOrder.isPending}
          style={styles.ctaButton}
        >
          Place Order
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
          <View style={styles.container}>
            {renderStepIndicator()}
            {step === 'product' && renderProductStep()}
            {step === 'summary' && renderSummaryStep()}
            {step === 'confirm' && renderConfirmStep()}
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  handleIndicatorBar: {
    alignSelf: 'center',
    backgroundColor: colors.gray[300],
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[300],
  },
  stepDotActive: {
    backgroundColor: colors.primary.amber,
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: colors.primary.amberLight,
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
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },

  // Summary step
  summaryRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: layout.cardRadius,
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
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
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
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
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
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  errorText: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Success state
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    marginBottom: spacing.sm,
  },
  successMessage: {
    marginBottom: spacing.lg,
  },
});

export default OrderBottomSheet;
