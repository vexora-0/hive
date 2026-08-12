import { describe, it, expect, beforeEach } from 'vitest';

import { useCartStore } from '@/features/orders/stores/cartStore';
import { PRODUCT_PRICES_CENTS } from '@/features/orders/constants/products';

/**
 * The cart.
 *
 * Two things make this worth pinning despite how small it is. Sign-out now
 * calls `clearCart` — one parent's basket must not survive into the next
 * person's session on a shared device — so `clearCart` is a privacy behaviour,
 * not a convenience. And money here is integer cents throughout: the product
 * catalogue and the order validator disagreed three ways before G-01, one of
 * the disagreements being dollars against cents.
 */

const cart = () => useCartStore.getState();

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('starts empty', () => {
    expect(cart().items).toEqual([]);
    expect(cart().getItemCount()).toBe(0);
    expect(cart().getTotalCents()).toBe(0);
  });

  describe('addItem', () => {
    it('adds an item priced from the catalogue, at quantity 1', () => {
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_4x6');

      expect(cart().items).toHaveLength(1);
      const [item] = cart().items;
      expect(item.photoId).toBe('photo-1');
      expect(item.photoUri).toBe('file:///tmp/1.jpg');
      expect(item.productType).toBe('print_4x6');
      expect(item.quantity).toBe(1);
      // Cents, from the shared catalogue — never a literal, and never dollars.
      expect(item.unitPriceCents).toBe(PRODUCT_PRICES_CENTS.print_4x6);
      expect(Number.isInteger(item.unitPriceCents)).toBe(true);
    });

    it('gives every line its own id, including the same photo twice', () => {
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_4x6');
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_5x7');
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_4x6');

      const ids = cart().items.map((i) => i.id);
      expect(new Set(ids).size).toBe(3);
      // Removing one line must not take its twin with it.
      cart().removeItem(ids[0]);
      expect(cart().items.map((i) => i.id)).toEqual([ids[1], ids[2]]);
    });
  });

  describe('totals', () => {
    it('sums unit price times quantity across lines', () => {
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_4x6');
      cart().addItem('photo-2', 'file:///tmp/2.jpg', 'photo_book');
      const [first] = cart().items;
      cart().updateQuantity(first.id, 3);

      expect(cart().getItemCount()).toBe(4);
      expect(cart().getTotalCents()).toBe(
        PRODUCT_PRICES_CENTS.print_4x6 * 3 + PRODUCT_PRICES_CENTS.photo_book,
      );
    });
  });

  describe('updateQuantity', () => {
    it('changes the quantity in place', () => {
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'mug');
      const [item] = cart().items;

      cart().updateQuantity(item.id, 5);

      expect(cart().items[0].quantity).toBe(5);
      expect(cart().items[0].id).toBe(item.id);
    });

    it('removes the line at zero or below rather than storing it', () => {
      // A zero-quantity line would pass the client and fail the server's
      // positive-integer check on the whole order.
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'mug');
      const [item] = cart().items;

      cart().updateQuantity(item.id, 0);
      expect(cart().items).toEqual([]);

      cart().addItem('photo-2', 'file:///tmp/2.jpg', 'magnet');
      cart().updateQuantity(cart().items[0].id, -1);
      expect(cart().items).toEqual([]);
    });

    it('ignores an id that is not in the cart', () => {
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'mug');
      cart().updateQuantity('no-such-line', 4);
      expect(cart().items).toHaveLength(1);
      expect(cart().items[0].quantity).toBe(1);
    });
  });

  describe('clearCart', () => {
    it('empties the cart — this is what sign-out relies on', () => {
      // On a shared tablet the next parent to sign in must not inherit the
      // previous one's basket, complete with thumbnails of another family's
      // child.
      cart().addItem('photo-1', 'file:///tmp/1.jpg', 'print_8x10');
      cart().addItem('photo-2', 'file:///tmp/2.jpg', 'digital_download');
      expect(cart().getItemCount()).toBe(2);

      cart().clearCart();

      expect(cart().items).toEqual([]);
      expect(cart().getItemCount()).toBe(0);
      expect(cart().getTotalCents()).toBe(0);
    });

    it('is idempotent', () => {
      cart().clearCart();
      cart().clearCart();
      expect(cart().items).toEqual([]);
    });
  });

  it('is a single module-level store, so every screen sees the same cart', async () => {
    // The feed adds to it, the cart screen reads it and sign-out clears it.
    const a = await import('@/features/orders/stores/cartStore');
    const b = await import('@/features/orders/stores/cartStore');
    expect(a.useCartStore).toBe(b.useCartStore);

    a.useCartStore.getState().addItem('photo-1', 'file:///tmp/1.jpg', 'magnet');
    expect(b.useCartStore.getState().getItemCount()).toBe(1);

    b.useCartStore.getState().clearCart();
    expect(a.useCartStore.getState().items).toEqual([]);
  });
});
