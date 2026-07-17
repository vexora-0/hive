import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { createNotification } from './notification.service';
import { PRODUCT_PRICES_CENTS } from '../constants/products';
import type { CreateOrderInput } from '../validators/order.validator';



interface OrderItem {
  id: string;
  order_id: string;
  photo_id: string;
  product_type: string;
  quantity: number;
  unit_price_cents: number;
}

interface Order {
  id: string;
  parent_id: string;
  school_id: string;
  status: string;
  shipping_address: string;
  notes: string | null;
  total_cents: number;
  created_at: string;
  items?: OrderItem[];
}

interface PaginatedOrders {
  orders: Order[];
  nextCursor: string | null;
}

export async function createOrder(
  parentId: string,
  schoolId: string,
  items: CreateOrderInput['items'],
  shippingAddress: string,
  notes?: string,
  idempotencyKey?: string,
): Promise<Order> {
  // 1. Validate photo ownership: all photos must be tagged with parent's children
  const { data: links } = await supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', parentId);

  const studentIds = links?.map((l) => l.student_id) ?? [];

  if (studentIds.length === 0) {
    throw new AppError(
      'No linked students found for this parent',
      400,
      'NO_STUDENTS',
    );
  }

  const photoIds = [...new Set(items.map((item) => item.photoId))];

  const { data: tags } = await supabaseAdmin
    .from('photo_student_tags')
    .select('photo_id')
    .in('photo_id', photoIds)
    .in('student_id', studentIds);

  const authorizedPhotoIds = new Set(tags?.map((t) => t.photo_id) ?? []);
  const unauthorized = photoIds.filter((id) => !authorizedPhotoIds.has(id));

  if (unauthorized.length > 0) {
    throw new AppError(
      'You can only order photos that include your children',
      403,
      'UNAUTHORIZED_PHOTOS',
    );
  }

  // 2. Calculate server-side prices
  const orderId = uuidv4();
  let subtotal = 0;

  const orderItems: Omit<OrderItem, 'id'>[] = items.map((item) => {
    const unitPrice = PRODUCT_PRICES_CENTS[item.productType];
    if (unitPrice === undefined) {
      throw new AppError(
        `Unknown product type: ${item.productType}`,
        400,
        'INVALID_PRODUCT',
      );
    }

    subtotal += unitPrice * item.quantity;

    return {
      order_id: orderId,
      photo_id: item.photoId,
      product_type: item.productType,
      quantity: item.quantity,
      unit_price_cents: unitPrice,
    };
  });

  // 3. Insert the order and its items in one transaction (G-37).
  //
  // These were previously two separate inserts with a compensating DELETE if
  // the second failed. A crash in between left an order with no items, and the
  // compensation never ran because the process was gone. A function body is a
  // single transaction, so either both land or neither does.
  const itemsWithIds = orderItems.map((item) => ({
    id: uuidv4(),
    ...item,
  }));

  const { error: rpcError } = await supabaseAdmin.rpc('create_order_with_items', {
    p_order_id: orderId,
    p_parent_id: parentId,
    p_school_id: schoolId,
    p_idempotency_key: idempotencyKey ?? uuidv4(),
    p_shipping_address: shippingAddress,
    p_notes: notes ?? null,
    p_total_cents: subtotal,
    p_items: itemsWithIds,
  });

  if (rpcError) {
    logger.error('Failed to create order', {
      error: rpcError.message,
      orderId,
    });
    throw new AppError('Failed to create order', 500, 'ORDER_CREATE_FAILED');
  }

  logger.info('Order created', {
    orderId,
    parentId,
    itemCount: items.length,
    total: subtotal,
  });

  // Fire-and-forget: notify school admins about the new order
  notifyAdminsOfNewOrder(schoolId, orderId, items.length, subtotal).catch(
    (err) => logger.error('Failed to notify admins of new order', { error: String(err), orderId }),
  );

  return {
    id: orderId,
    parent_id: parentId,
    school_id: schoolId,
    status: 'pending',
    shipping_address: shippingAddress,
    notes: notes ?? null,
    total_cents: subtotal,
    created_at: new Date().toISOString(),
    items: itemsWithIds,
  };
}

export async function getOrders(
  parentId: string,
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedOrders> {
  let query = supabaseAdmin
    .from('orders')
    .select('id, parent_id, school_id, status, shipping_address, notes, total_cents, created_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: orders, error } = await query;

  if (error) {
    logger.error('Failed to fetch orders', { error: error.message, parentId });
    throw new AppError('Failed to fetch orders', 500, 'QUERY_FAILED');
  }

  const hasNext = (orders?.length ?? 0) > limit;
  const results = (orders?.slice(0, limit) ?? []) as Order[];

  const nextCursor =
    hasNext && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: results[results.length - 1].created_at,
            id: results[results.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { orders: results, nextCursor };
}

export async function getOrderById(
  orderId: string,
  parentId: string,
): Promise<Order> {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, school_id, status, shipping_address, notes, total_cents, created_at')
    .eq('id', orderId)
    .eq('parent_id', parentId)
    .single();

  if (error || !order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id, photo_id, product_type, quantity, unit_price_cents')
    .eq('order_id', orderId);

  return { ...order, items: items ?? [] } as Order;
}

async function notifyAdminsOfNewOrder(
  schoolId: string,
  orderId: string,
  itemCount: number,
  totalCents: number,
): Promise<void> {
  // Scoped to the order's school. Platform admins seeded by seedAdmin.ts have
  // school_id = null and so are deliberately not notified here; Plan 06's seed
  // introduces school-scoped admins who will be.
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'admin');

  if (!admins || admins.length === 0) return;

  const total = `$${(totalCents / 100).toFixed(2)}`;

  await Promise.allSettled(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'new_order',
        'New Order Received',
        `A new order with ${itemCount} ${itemCount === 1 ? 'item' : 'items'} (${total}) has been placed.`,
        { order_id: orderId, item_count: itemCount, total_cents: totalCents },
      ),
    ),
  );
}
