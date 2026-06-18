import { Router } from 'express';
import { login, getMe, registerPushToken } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { loginSchema, pushTokenSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, getMe);
router.post('/push-token', authenticate, validate(pushTokenSchema), registerPushToken);

export default router;
