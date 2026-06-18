import { Router } from 'express';
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from '../schemas/user.schema';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', validate(listUsersQuerySchema, 'query'), listUsers);
router.post('/', validate(createUserSchema), createUser);
router.get('/:id', getUserById);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

export default router;
