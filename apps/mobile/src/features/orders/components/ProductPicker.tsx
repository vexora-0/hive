import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui';
import type { ProductType } from '@/types/supabase';
import { PRODUCT_PRICES } from '../stores/cartStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductPickerProps {
  /** Currently selected product type (if any). */
  selectedType: ProductType | null;
  /** Called when the user taps a product card. */
  onSelect: (type: ProductType) => void;
}

// ---------------------------------------------------------------------------
// Product metadata
// ---------------------------------------------------------------------------

interface ProductMeta {
  type: ProductType;
  label: string;
  icon: string;
}

const PRODUCTS: ProductMeta[] = [
  { type: 'print_4x6', label: '4x6 Print', icon: '🖼' },
  { type: 'print_5x7', label: '5x7 Print', icon: '🖼' },
  { type: 'print_8x10', label: '8x10 Print', icon: '🖼' },
  { type: 'digital_download', label: 'Digital Download', icon: '📥' },
  { type: 'photo_book', label: 'Photo Book', icon: '📖' },
  { type: 'magnet', label: 'Magnet', icon: '🧲' },
  { type: 'mug', label: 'Mug', icon: '☕' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ProductPicker>` — a 2-column grid of product type cards.
 *
 * Each card shows the product name, price, and an icon placeholder.
 * The selected card is highlighted with an amber border.
 */
export function ProductPicker({ selectedType, onSelect }: ProductPickerProps) {
  const handleSelect = useCallback(
    (type: ProductType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(type);
    },
    [onSelect],
  );

  return (
    <View style={styles.grid}>
      {PRODUCTS.map((product) => {
        const isSelected = selectedType === product.type;
        return (
          <Pressable
            key={product.type}
            onPress={() => handleSelect(product.type)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${product.label}, ${formatPrice(PRODUCT_PRICES[product.type])}`}
            style={({ pressed }) => [
              styles.card,
              isSelected && styles.cardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            <Text variant="h3" center>
              {product.icon}
            </Text>
            <Text
              variant="bodySmallBold"
              center
              style={styles.label}
              numberOfLines={1}
            >
              {product.label}
            </Text>
            <Text
              variant="bodyBold"
              color={isSelected ? colors.primary.amberDark : colors.text.accent}
              center
            >
              {formatPrice(PRODUCT_PRICES[product.type])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.background.surface,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border.light,
    // iOS shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    // Android shadow
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.primary.amber,
    backgroundColor: colors.primary.amber + '0A', // 4% amber tint
  },
  cardPressed: {
    opacity: 0.85,
  },
  label: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
});

export default ProductPicker;
