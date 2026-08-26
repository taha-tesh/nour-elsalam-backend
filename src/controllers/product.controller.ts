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
  ImportProductsJsonInput,
} from '../schemas/product.schema';

const productInclude = {
  category: { select: { id: true, nameAr: true, slug: true, icon: true } },
};

async function findProductByIdOrCode(idOrCode: string) {
  const parsedCode = Number(idOrCode);
  const productCode = Number.isInteger(parsedCode) && parsedCode > 0 ? parsedCode : undefined;

  return prisma.product.findFirst({
    where: {
      OR: [{ id: idOrCode }, ...(productCode !== undefined ? [{ productCode }] : [])],
    },
    include: productInclude,
  });
}

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, categoryId, isFeatured, inStock } =
      req.validatedQuery as unknown as ListProductsQuery;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch.length >= 2) {
        const numericSearch = Number(trimmedSearch);
        where.OR = [
          { titleAr: { contains: trimmedSearch, mode: 'insensitive' } },
          { descriptionAr: { contains: trimmedSearch, mode: 'insensitive' } },
          { brand: { contains: trimmedSearch, mode: 'insensitive' } },
          ...(Number.isInteger(numericSearch) && numericSearch > 0 ? [{ productCode: numericSearch }] : []),
        ];
      }
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

    const categoryId = data.categoryId || (await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } }))?.id;
    if (!categoryId) {
      throw new AppError(400, 'لا توجد أقسام متاحة لإضافة المنتج', 'NO_CATEGORIES');
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new AppError(404, 'القسم غير موجود', 'CATEGORY_NOT_FOUND');
    }

    const codeTaken = await prisma.product.findUnique({
      where: { productCode: data.productCode },
    });
    if (codeTaken) {
      throw new AppError(409, 'كود المنتج مستخدم بالفعل', 'CODE_EXISTS');
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        categoryId,
        productCode: data.productCode,
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

    if (data.productCode !== undefined) {
      const codeTaken = await prisma.product.findFirst({
        where: {
          productCode: data.productCode,
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
        productCode: data.productCode,
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

export async function importProductsJson(req: Request, res: Response, next: NextFunction) {
  try {
    const { products } = req.body as ImportProductsJsonInput;

    const categories = await prisma.category.findMany();
    const slugMap = new Map(categories.map((category) => [category.slug, category.id]));
    const categoryIdSet = new Set(categories.map((category) => category.id));

    const defaultCategorySlug = 'uncategorized';
    let defaultCategoryId = slugMap.get(defaultCategorySlug);
    if (!defaultCategoryId) {
      const defaultCategory = await prisma.category.upsert({
        where: { slug: defaultCategorySlug },
        update: {},
        create: {
          nameAr: 'بدون قسم',
          slug: defaultCategorySlug,
          sortOrder: 9999,
        },
      });
      defaultCategoryId = defaultCategory.id;
      slugMap.set(defaultCategorySlug, defaultCategoryId);
      categoryIdSet.add(defaultCategoryId);
    }

    const result = {
      created: 0,
      updated: 0,
      errors: [] as { index: number; productCode?: number | string; message: string }[],
    };

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const index = i + 1;

      try {
        const resolvedCategoryId = product.categoryId && categoryIdSet.has(product.categoryId)
          ? product.categoryId
          : product.categorySlug && slugMap.has(product.categorySlug)
          ? slugMap.get(product.categorySlug)
          : defaultCategoryId;

        if (!resolvedCategoryId) {
          throw new AppError(400, 'لا يمكن تحديد قسم للمنتج', 'CATEGORY_REQUIRED');
        }

        const productData = {
          productCode: product.productCode,
          titleAr: product.titleAr,
          descriptionAr: product.descriptionAr || '',
          price: product.price,
          stock: product.stock,
          categoryId: resolvedCategoryId,
          imageUrl: product.imageUrl || null,
          brand: product.brand || null,
          tags: Array.isArray(product.tags)
            ? product.tags.map((tag) => tag.trim()).filter(Boolean)
            : String(product.tags)
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
          specs: product.specs ?? undefined,
          isFeatured: product.isFeatured,
        };

        const existing = await prisma.product.findUnique({
          where: { productCode: productData.productCode },
        });

        if (existing) {
          await prisma.product.update({
            where: { productCode: productData.productCode },
            data: productData,
          });
          result.updated++;
        } else {
          await prisma.product.create({ data: productData });
          result.created++;
        }
      } catch (err) {
        result.errors.push({
          index,
          productCode: product.productCode,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    res.json({
      message: `تم استيراد ${result.created} منتجًا جديدًا وتحديث ${result.updated}`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}
