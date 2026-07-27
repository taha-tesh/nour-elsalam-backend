import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { comparePassword } from '../utils/password';
import { AppError } from '../utils/errors';
import { userSelect } from '../types/auth';
import { LoginInput, PushTokenInput } from '../schemas/auth.schema';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as LoginInput;
    const identifier = email.trim().toLowerCase();

    // Try to find user by email first, then by name
    let user = await prisma.user.findUnique({ where: { email: identifier } });
    
    if (!user) {
      // If not found by email, search by name
      user = await prisma.user.findFirst({ where: { name: email.trim() } });
    }

    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid username/email or password', 'INVALID_CREDENTIALS');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...safeUser } = user;

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userSelect,
    });

    if (!user) {
      throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function registerPushToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { expoPushToken } = req.body as PushTokenInput;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { expoPushToken },
    });

    res.json({ message: 'تم تسجيل رمز الإشعارات بنجاح' });
  } catch (err) {
    next(err);
  }
}
