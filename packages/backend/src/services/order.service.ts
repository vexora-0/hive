import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import { createNotification } from './notification.service';
import { PRODUCT_PRICES_PAISE } from '../constants/products';
import { getSignedPhotoUrls } from '../utils/supabaseStorage';
import type { CreateOrderInput, OrderStatus } from '../validators/order.validator';



interface OrderItem {
  id: string;
  order_id: string;
  photo_id: string;
  product_type: string;
  quantity: number;
  unit_price_cents: number;
  /**
   * Signed URL for the item's photo thumbnail. Only populated by
   * `getOrderById`; null when the photo or its object is missing.
   */
  thumbnailUrl?: string | null;
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

  // Only a photo that is actually available may be ordered. Tag ownership was
  // the sole check, so an archived photo — one a teacher had deliberately
  // removed — or one still processing could be bought from a stale feed. Both
  // are permanent once ordered: order_items.photo_id is ON DELETE RESTRICT.
  const { data: orderablePhotos, error: photoStatusError } = await supabaseAdmin
    .from('photos')
    .select('id')
    .in('id', photoIds)
    .eq('status', 'ready');

  if (photoStatusError) {
    logger.error('Failed to verify photo availability', {
      error: photoStatusError.message,
    });
    throw new AppError('Failed to create order', 500, 'QUERY_FAILED');
  }

  const readyPhotoIds = new Set(orderablePhotos?.map((p) => p.id) ?? []);
  if (photoIds.some((id) => !readyPhotoIds.has(id))) {
    throw new AppError(
      'One of these photos is no longer available to order',
      409,
      'PHOTO_UNAVAILABLE',
    );
  }

  // 2. Calculate server-side prices
  const orderId = uuidv4();
  let subtotal = 0;

  const orderItems: Omit<OrderItem, 'id'>[] = items.map((item) => {
    const unitPrice = PRODUCT_PRICES_PAISE[item.productType];
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
    const decoded = decodeCursor(cursor);
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data: orders, error } = await query;

  if (error) {
    logger.error('Failed to fetch orders', { error: error.message, parentId });
    throw new AppError('Failed to fetch orders', 500, 'QUERY_FAILED');
  }

  const hasNext = (orders?.length ?? 0) > limit;
  const results = (orders?.slice(0, limit) ?? []) as Order[];

  const last = results[results.length - 1];
  const nextCursor =
    hasNext && results.length > 0 ? encodeCursor(last.created_at, last.id) : null;

  return { orders: await withItems(results), nextCursor };
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

  return {
    ...order,
    items: await withThumbnailUrls(items ?? []),
  } as Order;
}

/**
 * Which statuses each status may move to.
 *
 * An order's status is the only thing a parent can see about fulfilment, so it
 * has to move forwards only. Without this an admin could walk a delivered
 * order back to pending, and the parent would get a notification saying their
 * delivered prints are being processed.
 *
 * 'delivered' and 'cancelled' are terminal — present here with empty lists so
 * that adding a status later is a change to this map and nothing else.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Wording for the notification a parent gets when their order moves. */
const STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending: 'Your order has been received.',
  confirmed: 'Your order has been confirmed and is being prepared.',
  processing: 'Your prints are being made.',
  shipped: 'Your order is on its way.',
  delivered: 'Your order has been delivered.',
  cancelled: 'Your order has been cancelled.',
};

/**
 * List the orders placed at one school, newest first.
 *
 * Admins had no way to see an order at all — orders were created and then
 * visible only to the parent who placed them, which left the whole fulfilment
 * side of the product unreachable. Cursor encoding is deliberately identical
 * to `getOrders` above so both lists paginate the same way.
 */
export async function getOrdersForSchool(
  schoolId: string | undefined,
  cursor?: string,
  limit: number = 20,
  status?: OrderStatus,
): Promise<PaginatedOrders> {
  let query = supabaseAdmin
    .from('orders')
    .select('id, parent_id, school_id, status, shipping_address, notes, total_cents, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  // No school means a platform admin, who sees every school's queue — the same
  // rule `updateOrderStatus` below already applies. Previously the controller
  // rejected this case with a 400, which the admin UI rendered as an empty
  // fulfilment queue, so orders looked like they did not exist.
  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data: orders, error } = await query;

  if (error) {
    logger.error('Failed to fetch school orders', { error: error.message, schoolId });
    throw new AppError('Failed to fetch orders', 500, 'QUERY_FAILED');
  }

  const hasNext = (orders?.length ?? 0) > limit;
  const results = (orders?.slice(0, limit) ?? []) as Order[];

  const last = results[results.length - 1];
  const nextCursor =
    hasNext && results.length > 0 ? encodeCursor(last.created_at, last.id) : null;

  return { orders: await withItems(results), nextCursor };
}

/**
 * Move an order to a new status and tell the parent.
 *
 * This is the first and only producer of the 'order_status' notification type,
 * which has been in the notifications CHECK constraint since migration 00010
 * with nothing ever creating one.
 *
 * Scoped to the admin's own school. A platform admin (school_id = null) is
 * allowed through to any school, matching how `roleGuard.assertSchoolAccess`
 * treats admins everywhere else.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  user: { id: string; role: string; schoolId: string | null },
): Promise<Order> {
  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, school_id, status, shipping_address, notes, total_cents, created_at')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  // A school-scoped admin may only touch their own school's orders.
  if (user.schoolId && order.school_id !== user.schoolId) {
    logger.warn('Blocked cross-school order update', {
      orderId,
      userId: user.id,
      orderSchoolId: order.school_id,
    });
    throw new AppError('You do not have access to this order', 403, 'FORBIDDEN');
  }

  const current = order.status as OrderStatus;

  if (current === status) {
    throw new AppError(`Order is already '${status}'`, 400, 'INVALID_TRANSITION');
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(
      allowed.length === 0
        ? `An order that is '${current}' cannot change status`
        : `Cannot move an order from '${current}' to '${status}'`,
      400,
      'INVALID_TRANSITION',
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateError) {
    logger.error('Failed to update order status', {
      error: updateError.message,
      orderId,
    });
    throw new AppError('Failed to update order status', 500, 'UPDATE_FAILED');
  }

  // Fire-and-forget, like notifyAdminsOfNewOrder: the status change is the
  // thing that had to succeed, and failing the request after it committed
  // would tell the admin the opposite of what happened.
  createNotification(
    order.parent_id,
    'order_status',
    'Order Update',
    STATUS_MESSAGES[status],
    { order_id: orderId, status, previous_status: current },
  ).catch((err) =>
    logger.error('Failed to notify parent of order status', {
      error: String(err),
      orderId,
    }),
  );

  logger.info('Order status updated', { orderId, from: current, to: status, userId: user.id });

  return { ...order, status } as Order;
}

/**
 * Let a parent cancel their own order.
 *
 * Only from 'pending' — once an admin has confirmed it, prints may already be
 * in production, so cancelling becomes a conversation rather than a button.
 * Deliberately a status change, not a delete: `order_items.photo_id` is
 * ON DELETE RESTRICT and the record is worth keeping either way.
 */
export async function cancelOrder(orderId: string, parentId: string): Promise<Order> {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, school_id, status, shipping_address, notes, total_cents, created_at')
    .eq('id', orderId)
    .eq('parent_id', parentId)
    .single();

  // Scoped by parent_id, so somebody else's order is a 404 rather than a 403 —
  // the same choice getOrderById and the photo detail endpoint make, so that a
  // response never confirms an order ID exists.
  if (error || !order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'pending') {
    throw new AppError(
      `An order that is '${order.status}' can no longer be cancelled`,
      400,
      'INVALID_TRANSITION',
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateError) {
    logger.error('Failed to cancel order', { error: updateError.message, orderId });
    throw new AppError('Failed to cancel order', 500, 'UPDATE_FAILED');
  }

  notifyAdminsOfCancelledOrder(order.school_id, orderId).catch((err) =>
    logger.error('Failed to notify admins of cancellation', {
      error: String(err),
      orderId,
    }),
  );

  logger.info('Order cancelled by parent', { orderId, parentId });

  return { ...order, status: 'cancelled' } as Order;
}

/**
 * Attach each order's items to it, for a whole page of orders at once.
 *
 * Both list endpoints selected the `orders` columns and nothing else, so every
 * order came back with `items` undefined. `OrderHistoryCard` renders
 * `order.items?.length ?? 0`, which meant every card in the order history read
 * "0 items" — including orders that really hold two.
 *
 * One query for the page, keyed on the ids just returned, rather than one per
 * order: a 20-order page would otherwise be 21 round trips to Postgres.
 *
 * Thumbnails are deliberately *not* signed here. The list only needs a count
 * and `getSignedPhotoUrls` is a network call per object — `getOrderById` still
 * signs them for the detail sheet, which is the only screen that shows images.
 */
async function withItems(orders: Order[]): Promise<Order[]> {
  if (orders.length === 0) return orders;

  const { data: items, error } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id, photo_id, product_type, quantity, unit_price_cents')
    .in(
      'order_id',
      orders.map((order) => order.id),
    );

  if (error) {
    // The list is still worth showing without item counts — status, total and
    // date all come from the rows we already have.
    logger.error('Failed to load items for order list', { error: error.message });
    return orders.map((order) => ({ ...order, items: [] }));
  }

  const itemsByOrderId = new Map<string, OrderItem[]>();
  for (const item of (items ?? []) as OrderItem[]) {
    const existing = itemsByOrderId.get(item.order_id);
    if (existing) existing.push(item);
    else itemsByOrderId.set(item.order_id, [item]);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) ?? [],
  }));
}

/**
 * Attach a signed thumbnail URL to each order item.
 *
 * An order item stores only `photo_id`, so the client had nothing to render and
 * showed a grey placeholder. The bucket is private (migration `00020`), so a
 * path is not enough — the URL has to be signed server-side.
 *
 * Falls back to the full-resolution object when a photo has no thumbnail yet,
 * matching the feed: a missing thumbnail should degrade to the original rather
 * than to an empty box. `thumbnailUrl` is camelCase to match the same field on
 * the feed and photo endpoints, which is where the client already reads signed
 * URLs from.
 */
async function withThumbnailUrls(items: OrderItem[]): Promise<OrderItem[]> {
  if (items.length === 0) return items;

  const photoIds = [...new Set(items.map((item) => item.photo_id))];

  const { data: photos, error } = await supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key')
    .in('id', photoIds);

  if (error) {
    // A thumbnail is not worth failing the order for — the caller still gets
    // the product, quantity and price, which is what the screen is about.
    logger.error('Failed to load order item photos', { error: error.message });
    return items.map((item) => ({ ...item, thumbnailUrl: null }));
  }

  const pathByPhotoId = new Map<string, string>();
  for (const photo of photos ?? []) {
    const path = photo.thumbnail_s3_key ?? photo.s3_key;
    if (path) pathByPhotoId.set(photo.id, path);
  }

  const signed = await getSignedPhotoUrls([...pathByPhotoId.values()]);

  return items.map((item) => {
    const path = pathByPhotoId.get(item.photo_id);
    return {
      ...item,
      thumbnailUrl: path ? (signed.get(path) ?? null) : null,
    };
  });
}

/**
 * The admins who should hear about an order at this school.
 *
 * Previously this was `.eq('school_id', schoolId)` alone, which in practice
 * notified **nobody**: the only admin any seed creates is a platform admin with
 * `school_id = null`, so the filter excluded the one account that exists. The
 * old comment said school-scoped admins "will be" introduced by Plan 06's seed;
 * they were not, and the notification has never reached a single user.
 *
 * Platform admins are included because they oversee every school — the same
 * reasoning `roleGuard.assertSchoolAccess` uses when it lets an admin through
 * to any school.
 */
async function getAdminRecipients(schoolId: string): Promise<string[]> {
  const { data: admins, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .or(`school_id.eq.${schoolId},school_id.is.null`);

  if (error) {
    logger.error('Failed to look up admin recipients', {
      error: error.message,
      schoolId,
    });
    return [];
  }

  return (admins ?? []).map((a) => a.id);
}

async function notifyAdminsOfCancelledOrder(
  schoolId: string,
  orderId: string,
): Promise<void> {
  const adminIds = await getAdminRecipients(schoolId);
  if (adminIds.length === 0) return;

  await Promise.allSettled(
    adminIds.map((adminId) =>
      createNotification(
        adminId,
        'order_status',
        'Order Cancelled',
        'A parent has cancelled their order.',
        { order_id: orderId, status: 'cancelled' },
      ),
    ),
  );
}

async function notifyAdminsOfNewOrder(
  schoolId: string,
  orderId: string,
  itemCount: number,
  totalCents: number,
): Promise<void> {
  const adminIds = await getAdminRecipients(schoolId);

  if (adminIds.length === 0) return;

  const total = `$${(totalCents / 100).toFixed(2)}`;

  await Promise.allSettled(
    adminIds.map((adminId) =>
      createNotification(
        adminId,
        'new_order',
        'New Order Received',
        `A new order with ${itemCount} ${itemCount === 1 ? 'item' : 'items'} (${total}) has been placed.`,
        { order_id: orderId, item_count: itemCount, total_cents: totalCents },
      ),
    ),
  );
}
