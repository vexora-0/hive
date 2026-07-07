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

export interface OrderWithItems extends Tables<'orders'> {
  items: Tables<'order_items'>[];
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
    const body: CreateOrderPayload = {
      items,
      shippingAddress: shippingAddress ?? '',
      notes,
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
};
