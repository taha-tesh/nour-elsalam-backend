import { Router } from 'express';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  downloadImportTemplate,
  importProductsExcel,
  importProductsJson,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  importExcelSchema,
  importProductsJsonSchema,
} from '../schemas/product.schema';

const router = Router();

router.get('/', validate(listProductsQuerySchema, 'query'), listProducts);

// Admin import routes — must be before /:id
router.get('/import/template', authenticate, requireAdmin, downloadImportTemplate);
router.post(
  '/import/excel',
  authenticate,
  requireAdmin,
  validate(importExcelSchema),
  importProductsExcel,
);

router.post('/import/json', validate(importProductsJsonSchema), importProductsJson);

router.get('/:id', getProductById);

router.post('/', authenticate, requireAdmin, validate(createProductSchema), createProduct);
router.put('/:id', authenticate, requireAdmin, validate(updateProductSchema), updateProduct);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

export default router;
