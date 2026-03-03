import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { idempotency } from '../middleware/idempotency';
import { createOrderSchema } from '../validators/order.validator';
import * as orderController from '../controllers/order.controller';

const router: import("express").Router = Router();

// All order routes require authentication
router.use(authenticate);

// POST /orders - Create order (parent only, with idempotency)
router.post(
  '/',
  roleGuard('parent'),
  idempotency,
  validate(createOrderSchema, 'body'),
  orderController.createOrder,
);

// GET /orders - Get order history (parent only)
router.get(
  '/',
  roleGuard('parent'),
  orderController.getOrders,
);

// GET /orders/:id - Get single order (parent only)
router.get(
  '/:id',
  roleGuard('parent'),
  orderController.getOrderById,
);

export default router;
