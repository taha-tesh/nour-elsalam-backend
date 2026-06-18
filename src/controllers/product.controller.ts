import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { serializeProduct } from '../utils/serialize';
import {
  ListProductsQuery,
  CreateProductInput,
  UpdateProductInput,
} from '../schemas/product.schema';

const productInclude = {
  category: { select: { id: true, nameAr: true, slug: true, icon: true } },
};

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, categoryId, isFeatured, inStock } =
      req.query as unknown as ListProductsQuery;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { titleAr: { contains: search, mode: 'insensitive' } },
        { descriptionAr: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (inStock !== undefined) where.stock = inStock ? { gt: 0 } : { lte: 0 };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(serializeProduct),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      throw new AppError(404, 'المنتج غير موجود', 'NOT_FOUND');
    }

    res.json({ product: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as CreateProductInput;

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new AppError(404, 'القسم غير موجود', 'CATEGORY_NOT_FOUND');
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        imageUrl: data.imageUrl || null,
      },
      include: productInclude,
    });

    res.status(201).json({
      message: 'تم إنشاء المنتج بنجاح',
      product: serializeProduct(product),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const data = req.body as UpdateProductInput;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'المنتج غير موجود', 'NOT_FOUND');
    }

    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        throw new AppError(404, 'القسم غير موجود', 'CATEGORY_NOT_FOUND');
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      },
      include: productInclude,
    });

    res.json({
      message: 'تم تحديث المنتج بنجاح',
      product: serializeProduct(product),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      throw new AppError(400, 'لا يمكن حذف منتج مرتبط بطلبات', 'PRODUCT_HAS_ORDERS');
    }

    await prisma.product.delete({ where: { id } });

    res.json({ message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return next(new AppError(404, 'المنتج غير موجود', 'NOT_FOUND'));
    }
    next(err);
  }
}
