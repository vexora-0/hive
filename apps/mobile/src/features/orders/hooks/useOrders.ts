import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useToast } from '@/components/feedback';
import { apiErrorMessage } from '@/utils/errorMessage';
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
  const toast = useToast();

  return useMutation({
    mutationFn: ({ items, shippingAddress, notes, idempotencyKey }: CreateOrderParams) =>
      orderService.createOrder(items, shippingAddress, notes, idempotencyKey),

    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('Order placed successfully');
    },

    // There was no error handler at all, so a failed order looked identical to
    // no interaction. Surfaces the server message where there is one — the API
    // returns useful text for authorisation and validation failures.
    onError: (error: unknown) =>
      toast.error(
        apiErrorMessage(error, 'Could not place order. Please try again.'),
      ),
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

// ---------------------------------------------------------------------------
// useCancelOrder
// ---------------------------------------------------------------------------

/**
 * `useCancelOrder` -- cancels a pending order.
 *
 * Invalidates both the list and the detail: the sheet the parent is looking at
 * has to show the new status, and the row behind it has to stop saying
 * "pending".
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (orderId: string) => orderService.cancelOrder(orderId),

    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Order cancelled');
    },

    onError: (error: unknown) =>
      toast.error(
        apiErrorMessage(error, 'Could not cancel this order. Please try again.'),
      ),
  });
}
