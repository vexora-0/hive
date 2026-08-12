import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { PRODUCT_PRICES_PAISE, type ProductType } from '../constants/products';

// ---------------------------------------------------------------------------
// Product Prices
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartItem {
  id: string;
  photoId: string;
  photoUri: string;
  productType: ProductType;
  quantity: number;
  unitPriceCents: number;
}

interface CartStoreState {
  items: CartItem[];
}

interface CartStoreActions {
  /** Add a new item to the cart. Unit price is auto-set from the product type. */
  addItem: (photoId: string, photoUri: string, productType: ProductType) => void;
  /** Remove an item from the cart by its ID. */
  removeItem: (id: string) => void;
  /** Update the quantity of a cart item. Removes the item if quantity <= 0. */
  updateQuantity: (id: string, quantity: number) => void;
  /** Clear all items from the cart. */
  clearCart: () => void;
  /** Compute the total price of all items in the cart. */
  /** Total in integer cents. */
  getTotalCents: () => number;
  /** Compute the total number of items in the cart. */
  getItemCount: () => number;
}

type CartStore = CartStoreState & CartStoreActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCartStore = create<CartStore>((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────
  items: [],

  // ── Actions ────────────────────────────────────────────────────────────

  addItem: (photoId, photoUri, productType) => {
    const newItem: CartItem = {
      id: uuidv4(),
      photoId,
      photoUri,
      productType,
      quantity: 1,
      unitPriceCents: PRODUCT_PRICES_PAISE[productType],
    };

    set((state) => ({
      items: [...state.items, newItem],
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      ),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotalCents: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
