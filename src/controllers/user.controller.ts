import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../utils/errors';
import { userSelect } from '../types/auth';
import {
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
} from '../schemas/user.schema';

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as CreateUserInput;

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new AppError(409, 'البريد الإلكتروني مستخدم بالفعل', 'EMAIL_EXISTS');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        phone: data.phone,
        role: data.role,
      },
      select: userSelect,
    });

    res.status(201).json({
      message: 'تم إنشاء المستخدم بنجاح',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, role, isActive } = req.query as unknown as ListUsersQuery;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total, activeCount, pendingCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        from: total === 0 ? 0 : skip + 1,
        to: Math.min(skip + limit, total),
      },
      stats: {
        totalUsers: await prisma.user.count(),
        activeAccounts: activeCount,
        pendingReview: pendingCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
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

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const data = req.body as UpdateUserInput;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
    }

    // Prevent admin from deactivating themselves
    if (req.user!.id === id && data.isActive === false) {
      throw new AppError(400, 'لا يمكنك تعطيل حسابك الخاص', 'SELF_DEACTIVATE');
    }

    // Prevent removing the last active admin
    if (existing.role === 'ADMIN' && data.role === 'USER') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (adminCount === 0) {
        throw new AppError(400, 'يجب أن يبقى مدير نظام واحد على الأقل', 'LAST_ADMIN');
      }
    }

    if (data.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), id: { not: id } },
      });
      if (emailTaken) {
        throw new AppError(409, 'البريد الإلكتروني مستخدم بالفعل', 'EMAIL_EXISTS');
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) updateData.password = await hashPassword(data.password);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    res.json({
      message: 'تم تحديث المستخدم بنجاح',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    if (req.user!.id === id) {
      throw new AppError(400, 'لا يمكنك حذف حسابك الخاص', 'SELF_DELETE');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'المستخدم غير موجود', 'NOT_FOUND');
    }

    if (existing.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (adminCount === 0) {
        throw new AppError(400, 'لا يمكن حذف آخر مدير نظام', 'LAST_ADMIN');
      }
    }

    // Soft-delete: deactivate account (preserves order history)
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });

    res.json({
      message: 'تم تعطيل المستخدم بنجاح',
      user,
    });
  } catch (err) {
    next(err);
  }
}
