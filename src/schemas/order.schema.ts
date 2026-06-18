import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'يجب إضافة منتج واحد على الأقل'),
  shippingAddress: z.string().min(5, 'عنوان التوصيل مطلوب'),
  shippingCity: z.string().min(2, 'المدينة مطلوبة'),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().optional(),
  shippingCompany: z.string().optional(),
});

export const createFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().min(3, 'التعليق مطلوب'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
