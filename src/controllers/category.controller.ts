import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema';

const categoryInclude = {
  _count: { select: { products: true } },
};

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const includeProducts = Boolean(req.query.includeProducts);

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: includeProducts
        ? {
            products: {
              where: { stock: { gt: 0 } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            ...categoryInclude,
          }
        : categoryInclude,
    });

    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const category = await prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });

    if (!category) {
      throw new AppError(404, 'القسم غير موجود', 'NOT_FOUND');
    }

    res.json({ category });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as CreateCategoryInput;

    const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new AppError(409, 'رابط القسم مستخدم بالفعل', 'SLUG_EXISTS');
    }

    const category = await prisma.category.create({
      data,
      include: categoryInclude,
    });

    res.status(201).json({ message: 'تم إنشاء القسم بنجاح', category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const data = req.body as UpdateCategoryInput;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'القسم غير موجود', 'NOT_FOUND');
    }

    if (data.slug) {
      const slugTaken = await prisma.category.findFirst({
        where: { slug: data.slug, id: { not: id } },
      });
      if (slugTaken) {
        throw new AppError(409, 'رابط القسم مستخدم بالفعل', 'SLUG_EXISTS');
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data,
      include: categoryInclude,
    });

    res.json({ message: 'تم تحديث القسم بنجاح', category });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new AppError(400, 'لا يمكن حذف قسم يحتوي على منتجات', 'CATEGORY_HAS_PRODUCTS');
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: 'تم حذف القسم بنجاح' });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return next(new AppError(404, 'القسم غير موجود', 'NOT_FOUND'));
    }
    next(err);
  }
}
