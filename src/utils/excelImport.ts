import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { EXCEL_COLUMNS } from '../schemas/product.schema';

export type ImportRow = {
  productCode: string;
  titleAr: string;
  descriptionAr: string;
  price: number;
  stock: number;
  categorySlug: string;
  brand?: string;
  imageUrl?: string;
  isFeatured?: boolean | string;
  tags?: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; productCode?: string; message: string }[];
};

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'نعم'].includes(value.toLowerCase().trim());
  }
  return false;
}

function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseExcelBuffer(buffer: Buffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError(400, 'ملف Excel فارغ', 'EMPTY_FILE');

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return raw.map((row) => ({
    productCode: String(row.productCode ?? row['كود المنتج'] ?? '').trim(),
    titleAr: String(row.titleAr ?? row['العنوان'] ?? '').trim(),
    descriptionAr: String(row.descriptionAr ?? row['الوصف'] ?? '').trim(),
    price: Number(row.price ?? row['السعر'] ?? 0),
    stock: Number(row.stock ?? row['المخزون'] ?? 0),
    categorySlug: String(row.categorySlug ?? row['القسم'] ?? '').trim(),
    brand: String(row.brand ?? row['الماركة'] ?? '').trim() || undefined,
    imageUrl: String(row.imageUrl ?? row['رابط الصورة'] ?? '').trim() || undefined,
    isFeatured: (row.isFeatured ?? row['مميز']) as boolean | string | undefined,
    tags: String(row.tags ?? row['الوسوم'] ?? '').trim() || undefined,
  }));
}

export function buildTemplateBuffer(): Buffer {
  const sample = [
    {
      productCode: 'PRD-001',
      titleAr: 'دريل لاسلكي 18 فولت',
      descriptionAr: 'وصف المنتج بالعربية...',
      price: 450,
      stock: 25,
      categorySlug: 'power-tools',
      brand: 'بوش',
      imageUrl: '',
      isFeatured: 'true',
      tags: 'أدوات طاقة,لاسلكي',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample, { header: [...EXCEL_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Products');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function importProductsFromRows(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, errors: [] };

  const categories = await prisma.category.findMany();
  const slugMap = new Map(categories.map((c) => [c.slug, c.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      if (!row.productCode) {
        throw new Error('Product code is required');
      }
      if (!row.titleAr) throw new Error('Product title is required');
      if (!Number.isFinite(row.price)) throw new Error('Invalid price');
      if (!Number.isFinite(row.stock)) throw new Error('Invalid stock');

      const categoryId = slugMap.get(row.categorySlug);
      if (!categoryId) {
        throw new Error(`القسم "${row.categorySlug}" غير موجود`);
      }

      const data = {
        productCode: row.productCode.toUpperCase(),
        titleAr: row.titleAr,
        descriptionAr: row.descriptionAr,
        price: row.price,
        stock: Math.floor(row.stock),
        categoryId,
        brand: row.brand ?? null,
        imageUrl: row.imageUrl || null,
        isFeatured: parseBool(row.isFeatured),
        tags: parseTags(row.tags),
      };

      const existing = await prisma.product.findUnique({
        where: { productCode: data.productCode },
      });

      if (existing) {
        await prisma.product.update({ where: { productCode: data.productCode }, data });
        result.updated++;
      } else {
        await prisma.product.create({ data });
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: rowNum,
        productCode: row.productCode,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}
