import { Router } from 'express';
import {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderStatus,
  submitFeedback,
  getOrderFeedback,
} from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  updateOrderStatusSchema,
  createFeedbackSchema,
} from '../schemas/order.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listOrdersQuerySchema, 'query'), listOrders);
router.post('/', validate(createOrderSchema), createOrder);
router.get('/:id', getOrderById);
router.patch('/:id/status', requireAdmin, validate(updateOrderStatusSchema), updateOrderStatus);
router.post('/:id/feedback', validate(createFeedbackSchema), submitFeedback);
router.get('/:id/feedback', getOrderFeedback);

export default router;
