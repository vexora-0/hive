import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/order.service';
import { success, paginated } from '../utils/apiResponse';
import { AppError } from '../middleware/errorHandler';
import type {
  CreateOrderInput,
  GetOrdersInput,
  GetSchoolOrdersInput,
  UpdateOrderStatusInput,
} from '../validators/order.validator';

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parentId = req.user!.id;
    const schoolId = req.user!.schoolId;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    const data = req.body as CreateOrderInput;

    if (!schoolId) {
      throw new AppError(
        'User must be associated with a school to place orders',
        400,
        'NO_SCHOOL',
      );
    }

    const order = await orderService.createOrder(
      parentId,
      schoolId,
      data.items,
      data.shippingAddress,
      // The schema accepts null (what the mobile client sends for a blank
      // optional field) but the service takes an optional string.
      data.notes ?? undefined,
      idempotencyKey,
    );

    res.status(201).json(success(order, 'Order created successfully'));
  } catch (err) {
    next(err);
  }
}

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parentId = req.user!.id;
    // Validated and coerced by validate(getOrdersSchema, 'query'): limit is a
    // number, defaulted to 20 and already clamped to 1..50.
    const { cursor, limit } = req.query as unknown as GetOrdersInput;

    const result = await orderService.getOrders(parentId, cursor, limit);

    res.json(paginated(result.orders, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parentId = req.user!.id;
    const { id } = req.params;

    const order = await orderService.getOrderById(id, parentId);

    res.json(success(order));
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parentId = req.user!.id;
    const { id } = req.params;

    const order = await orderService.cancelOrder(id, parentId);

    res.json(success(order, 'Order cancelled'));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/orders — the fulfilment queue for one school.
 *
 * A platform admin has no school of their own, so there is nothing to scope
 * to. Rather than silently listing every school's orders, ask for the school
 * explicitly; the admin UI already knows which school it is looking at.
 */
export async function getSchoolOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as GetSchoolOrdersInput;
    const { cursor, limit, status } = query;
    // An admin with no school of their own is a platform admin: absent an
    // explicit ?schoolId filter they get every school's orders, rather than the
    // 400 that used to surface in the UI as an empty queue.
    const schoolId = req.user!.schoolId ?? query.schoolId ?? undefined;

    const result = await orderService.getOrdersForSchool(
      schoolId,
      cursor,
      limit,
      status,
    );

    res.json(paginated(result.orders, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateOrderStatusInput;

    const order = await orderService.updateOrderStatus(id, status, req.user!);

    res.json(success(order, 'Order status updated'));
  } catch (err) {
    next(err);
  }
}
