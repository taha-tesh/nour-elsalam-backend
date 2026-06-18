import { Router } from 'express';
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from '../schemas/category.schema';

const router = Router();

router.get('/', validate(listCategoriesQuerySchema, 'query'), listCategories);
router.get('/:id', getCategoryById);

router.post('/', authenticate, requireAdmin, validate(createCategorySchema), createCategory);
router.put('/:id', authenticate, requireAdmin, validate(updateCategorySchema), updateCategory);
router.delete('/:id', authenticate, requireAdmin, deleteCategory);

export default router;
