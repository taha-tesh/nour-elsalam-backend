import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  isFeatured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const createProductSchema = z.object({
  titleAr: z.string().min(2, 'عنوان المنتج مطلوب'),
  descriptionAr: z.string().min(10, 'وصف المنتج مطلوب'),
  price: z.coerce.number().positive('السعر يجب أن يكون أكبر من صفر'),
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().or(z.literal('')),
  brand: z.string().optional(),
  tags: z.array(z.string()).default([]),
  specs: z.record(z.string()).optional(),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().min(1, 'القسم مطلوب'),
});

export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'يجب توفير حقل واحد على الأقل للتحديث' },
);

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
