import { z } from 'zod';

export const listCategoriesQuerySchema = z.object({
  includeProducts: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const createCategorySchema = z.object({
  nameAr: z.string().min(2, 'Category name is required'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط'),
  icon: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'يجب توفير حقل واحد على الأقل للتحديث' },
);

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
