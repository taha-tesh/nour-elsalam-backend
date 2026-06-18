import { Router } from 'express';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
} from '../schemas/product.schema';

const router = Router();

router.get('/', validate(listProductsQuerySchema, 'query'), listProducts);
router.get('/:id', getProductById);

router.post('/', authenticate, requireAdmin, validate(createProductSchema), createProduct);
router.put('/:id', authenticate, requireAdmin, validate(updateProductSchema), updateProduct);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

export default router;
