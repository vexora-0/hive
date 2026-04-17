import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useCartStore } from '../stores/cartStore';
import {
  orderService,
  type CreateOrderItemPayload,
} from '../services/orderService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// useCreateOrder
// ---------------------------------------------------------------------------

interface CreateOrderParams {
  items: CreateOrderItemPayload[];
  shippingAddress: string | null;
  notes: string | null;
  idempotencyKey: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const clearCart = useCartStore((s) => s.clearCart);

  return useMutation({
    mutationFn: ({ items, shippingAddress, notes, idempotencyKey }: CreateOrderParams) =>
      orderService.createOrder(items, shippingAddress, notes, idempotencyKey),

    onSuccess: () => {
      // Clear the local cart after a successful order
      clearCart();
      // Invalidate the orders list so it refetches fresh data
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// useOrders  (infinite scrolling list)
// ---------------------------------------------------------------------------

export function useOrders(limit: number = 20) {
  return useInfiniteQuery({
    queryKey: orderKeys.lists(),
    queryFn: ({ pageParam }) =>
      orderService.getOrders(pageParam as string | undefined, limit),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });
}

// ---------------------------------------------------------------------------
// useOrderDetail
// ---------------------------------------------------------------------------

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => orderService.getOrderById(orderId),
    enabled: !!orderId,
  });
}
