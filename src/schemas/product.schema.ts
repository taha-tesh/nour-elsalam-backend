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

const parseTags = (value: string[] | string | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export const createProductSchema = z.object({
  productCode: z
    .string()
    .trim()
    .min(2, 'كود المنتج مطلوب')
    .regex(/^[A-Za-z0-9_.-]+$/, 'كود المنتج: أحرف إنجليزية وأرقام و - _ . فقط'),
  titleAr: z.string().trim().min(1, 'عنوان المنتج مطلوب'),
  descriptionAr: z.string().trim().optional().default(''),
  price: z.coerce.number().refine((value) => Number.isFinite(value), 'السعر غير صالح'),
  stock: z.coerce.number().int().refine((value) => Number.isFinite(value), 'المخزون غير صالح'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  brand: z.string().optional(),
  tags: z.array(z.string()).default([]),
  specs: z.record(z.string()).optional(),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().optional(),
});

export const importProductJsonSchema = z.object({
  productCode: z
    .string()
    .trim()
    .min(2, 'Product code is required')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Product code: alphanumeric, - and _ . only'),
  titleAr: z.string().trim().min(1, 'Product title is required'),
  descriptionAr: z.string().optional().default(''),
  price: z.coerce.number().refine((value) => Number.isFinite(value), 'السعر غير صالح'),
  stock: z.coerce.number().int().refine((value) => Number.isFinite(value), 'المخزون غير صالح'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  brand: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).transform(parseTags).default([]),
  specs: z.record(z.string()).optional(),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
});

export const importProductsJsonSchema = z.object({
  products: z.array(importProductJsonSchema).min(1, 'At least one product is required'),
});

export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required to update' },
);

export const importExcelSchema = z.object({
  fileBase64: z.string().min(1, 'Excel file is required'),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ImportProductsJsonInput = z.infer<typeof importProductsJsonSchema>;

/** Expected Excel column headers (row 1) */
export const EXCEL_COLUMNS = [
  'productCode',
  'titleAr',
  'descriptionAr',
  'price',
  'stock',
  'categorySlug',
  'brand',
  'imageUrl',
  'isFeatured',
  'tags',
] as const;
