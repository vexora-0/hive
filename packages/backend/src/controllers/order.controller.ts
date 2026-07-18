import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/order.service';
import { success, paginated } from '../utils/apiResponse';
import type {
  CreateOrderInput,
  GetOrdersInput,
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
      res.status(400).json({
        success: false,
        message: 'User must be associated with a school to place orders',
        code: 'NO_SCHOOL',
      });
      return;
    }

    const order = await orderService.createOrder(
      parentId,
      schoolId,
      data.items,
      data.shippingAddress,
      data.notes,
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
