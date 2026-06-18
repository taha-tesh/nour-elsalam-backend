import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/errors';

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'يجب تسجيل الدخول', 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'ليس لديك صلاحية للوصول', 'FORBIDDEN'));
    }

    next();
  };
}

export const requireAdmin = requireRole(Role.ADMIN);
