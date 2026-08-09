import { apiRequest } from '@/lib/api';
import type { Tables } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateOrderItemPayload {
  photoId: string;
  productType: string;
  quantity: number;
  // No unitPrice — the server prices from its own table so a client cannot
  // influence what it is charged.
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[];
  shippingAddress: string;
  notes?: string | null;
}

export interface CreateOrderResponse {
  order: Tables<'orders'>;
  items: Tables<'order_items'>[];
}

export interface OrderItemWithThumbnail extends Tables<'order_items'> {
  /**
   * Signed thumbnail URL, added by `GET /orders/:id`. The photos bucket is
   * private, so this is the only way to render the image. Absent on the list
   * endpoint and null when the photo has no object behind it.
   */
  thumbnailUrl?: string | null;
}

export interface OrderWithItems extends Tables<'orders'> {
  items: OrderItemWithThumbnail[];
}

export interface PaginatedOrdersResponse {
  orders: OrderWithItems[];
  next_cursor: string | null;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const orderService = {
  /**
   * Create a new order.
   *
   * The `idempotencyKey` is sent as an `X-Idempotency-Key` header so the
   * backend can safely deduplicate retried requests.
   */
  createOrder: async (
    items: CreateOrderItemPayload[],
    shippingAddress: string | null,
    notes: string | null,
    idempotencyKey: string,
  ): Promise<CreateOrderResponse> => {
    // `notes` is optional server-side, so omit the key entirely when it is
    // blank rather than sending an explicit null — the validator accepts a
    // string or nothing at all.
    const body: CreateOrderPayload = {
      items,
      shippingAddress: shippingAddress ?? '',
      ...(notes ? { notes } : {}),
    };

    const res = await apiRequest<{ success: true; data: CreateOrderResponse }>('/orders', {
      method: 'POST',
      body,
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
    });
    return res.data;
  },

  /**
   * Fetch a paginated list of orders for the authenticated user.
   */
  getOrders: async (
    cursor?: string,
    limit: number = 20,
  ): Promise<PaginatedOrdersResponse> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const res = await apiRequest<{ success: true; data: OrderWithItems[]; cursor: string | null }>(
      `/orders?${params.toString()}`,
    );

    return {
      orders: res.data ?? [],
      next_cursor: res.cursor ?? null,
      has_more: !!res.cursor,
    };
  },

  /**
   * Fetch a single order by ID, including its items.
   */
  getOrderById: async (orderId: string): Promise<OrderWithItems> => {
    const res = await apiRequest<{ success: true; data: OrderWithItems }>(`/orders/${orderId}`);
    return res.data;
  },

  /**
   * Cancel one of your own orders.
   *
   * The server only allows this while the order is still `pending`; once an
   * admin has confirmed it, prints may already be in production.
   */
  cancelOrder: async (orderId: string): Promise<OrderWithItems> => {
    const res = await apiRequest<{ success: true; data: OrderWithItems }>(
      `/orders/${orderId}/cancel`,
      { method: 'PATCH' },
    );
    return res.data;
  },
};
