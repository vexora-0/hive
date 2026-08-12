import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, spring, shadows, platformShadow } from '@/theme';
import { Text } from '@/components/ui';
import type { ProductType } from '@/types/supabase';
import { PRODUCT_PRICES_PAISE, PRODUCT_LABELS, formatRupees } from '../constants/products';

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
  icon: keyof typeof Ionicons.glyphMap;
  /** What the parent actually receives. Sets expectations before they buy. */
  note: string;
}

/**
 * Icons rather than emoji. Emoji render differently on iOS and Android, cannot
 * take a brand colour, and three of the seven products were sharing the same
 * picture frame glyph — so the grid gave no help telling a 4×6 from an 8×10.
 */
const PRODUCTS: ProductMeta[] = [
  { type: 'print_4x6', icon: 'image', note: 'Postcard size' },
  { type: 'print_5x7', icon: 'image', note: 'Desk frame size' },
  { type: 'print_8x10', icon: 'expand', note: 'Wall size' },
  { type: 'digital_download', icon: 'cloud-download', note: 'Full resolution file' },
  { type: 'photo_book', icon: 'book', note: '20 pages, hardbound' },
  { type: 'magnet', icon: 'magnet', note: 'For the fridge' },
  { type: 'mug', icon: 'cafe', note: '330 ml ceramic' },
];

// ---------------------------------------------------------------------------
// One product
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProductCardProps {
  product: ProductMeta;
  isSelected: boolean;
  onPress: () => void;
}

function ProductCard({ product, isSelected, onPress }: ProductCardProps) {
  const label = PRODUCT_LABELS[product.type];
  const price = PRODUCT_PRICES_PAISE[product.type];

  const selected = useDerivedValue(
    () => withSpring(isSelected ? 1 : 0, spring.snappy),
    [isSelected],
  );

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selected.value,
      [0, 1],
      [colors.border.light, colors.primary.amber],
    ),
    backgroundColor: interpolateColor(
      selected.value,
      [0, 1],
      [colors.background.surface, colors.primary.amberWash],
    ),
    transform: [{ scale: 1 + selected.value * 0.015 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${label}, ${formatRupees(price)}. ${product.note}`}
      style={[styles.card, cardStyle]}
    >
      <View style={styles.cardTop}>
        <Ionicons
          name={product.icon}
          size={19}
          color={isSelected ? colors.text.accent : colors.text.tertiary}
        />
        {isSelected && (
          <Ionicons name="checkmark-circle" size={19} color={colors.primary.amberDark} />
        )}
      </View>

      <Text variant="bodySmallBold" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <Text variant="caption" color={colors.text.tertiary} numberOfLines={1}>
        {product.note}
      </Text>

      <Text variant="price" style={styles.price}>
        {formatRupees(price)}
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ProductPicker>` — the catalogue, as a two-column grid.
 *
 * Selection is carried by a marigold wash and a tick, not by a thicker border:
 * a border that grows on selection nudges every other card in the row.
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
      {PRODUCTS.map((product) => (
        <ProductCard
          key={product.type}
          product={product}
          isSelected={selectedType === product.type}
          onPress={() => handleSelect(product.type)}
        />
      ))}
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
    gap: spacing.ms,
  },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    ...platformShadow(shadows.small),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.ms,
    minHeight: 20,
  },
  label: {
    marginBottom: spacing.xxs,
  },
  price: {
    marginTop: spacing.sm,
  },
});

export default ProductPicker;
