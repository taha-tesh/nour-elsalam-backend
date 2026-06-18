import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';
import { AppError } from '../utils/errors';
import { userSelect } from '../types/auth';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'يجب تسجيل الدخول', 'UNAUTHORIZED');
    }

    const token = header.slice(7);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: userSelect,
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'الجلسة غير صالحة أو الحساب معطل', 'UNAUTHORIZED');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError(401, 'رمز الدخول غير صالح أو منتهي الصلاحية', 'INVALID_TOKEN'));
  }
}
