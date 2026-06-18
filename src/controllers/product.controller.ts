import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { serializeProduct } from '../utils/serialize';
import {
  buildTemplateBuffer,
  importProductsFromRows,
  parseExcelBuffer,
} from '../utils/excelImport';
import {
  ListProductsQuery,
  CreateProductInput,
  UpdateProductInput,
} from '../schemas/product.schema';

const productInclude = {
  category: { select: { id: true, nameAr: true, slug: true, icon: true } },
};

async function findProductByIdOrCode(idOrCode: string) {
  return prisma.product.findFirst({
    where: {
      OR: [{ id: idOrCode }, { productCode: idOrCode.toUpperCase() }],
    },
    include: productInclude,
  });
}

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
        { productCode: { contains: search, mode: 'insensitive' } },
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
    const product = await findProductByIdOrCode(id);

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

    const codeTaken = await prisma.product.findUnique({
      where: { productCode: data.productCode.toUpperCase() },
    });
    if (codeTaken) {
      throw new AppError(409, 'كود المنتج مستخدم بالفعل', 'CODE_EXISTS');
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        productCode: data.productCode.toUpperCase(),
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

    const existing = await findProductByIdOrCode(id);
    if (!existing) {
      throw new AppError(404, 'المنتج غير موجود', 'NOT_FOUND');
    }

    if (data.productCode) {
      const codeTaken = await prisma.product.findFirst({
        where: {
          productCode: data.productCode.toUpperCase(),
          id: { not: existing.id },
        },
      });
      if (codeTaken) {
        throw new AppError(409, 'كود المنتج مستخدم بالفعل', 'CODE_EXISTS');
      }
    }

    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        throw new AppError(404, 'القسم غير موجود', 'CATEGORY_NOT_FOUND');
      }
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...data,
        productCode: data.productCode?.toUpperCase(),
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
    const existing = await findProductByIdOrCode(id);
    if (!existing) {
      throw new AppError(404, 'المنتج غير موجود', 'NOT_FOUND');
    }

    const orderItemCount = await prisma.orderItem.count({ where: { productId: existing.id } });
    if (orderItemCount > 0) {
      throw new AppError(400, 'لا يمكن حذف منتج مرتبط بطلبات', 'PRODUCT_HAS_ORDERS');
    }

    await prisma.product.delete({ where: { id: existing.id } });

    res.json({ message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    next(err);
  }
}

export async function downloadImportTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = buildTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=products-template.xlsx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importProductsExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileBase64 } = req.body as { fileBase64: string };
    const buffer = Buffer.from(fileBase64, 'base64');
    const rows = parseExcelBuffer(buffer);
    const result = await importProductsFromRows(rows);

    res.json({
      message: `تم استيراد ${result.created} منتج جديد وتحديث ${result.updated}`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}
