import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@baytaladad.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'مدير النظام';
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '+966500000000';

const categories = [
  { nameAr: 'أدوات كهربائية', slug: 'power-tools', icon: 'bolt', sortOrder: 1 },
  { nameAr: 'معدات يدوية', slug: 'hand-tools', icon: 'hand', sortOrder: 2 },
  { nameAr: 'مواد بناء', slug: 'building-materials', icon: 'home', sortOrder: 3 },
  { nameAr: 'براغي ومثبتات', slug: 'screws-fasteners', icon: 'screw', sortOrder: 4 },
  { nameAr: 'أدوات السلامة', slug: 'safety-tools', icon: 'hard-hat', sortOrder: 5 },
];

async function seedCategories() {
  const created: Record<string, string> = {};

  for (const cat of categories) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { nameAr: cat.nameAr, icon: cat.icon, sortOrder: cat.sortOrder },
      create: cat,
    });
    created[cat.slug] = record.id;
  }

  return created;
}

async function seedProducts(categoryIds: Record<string, string>) {
  const products = [
    {
      titleAr: 'دريل شحن لاسلكي 18 فولت ليثيوم',
      descriptionAr:
        'دريل لاسلكي احترافي 18 فولت مناسب لجميع أعمال الحفر والتثبيت. يتميز ببطارية ليثيوم طويلة الأمد وقبضة مريحة للاستخدام المطول.',
      price: 650,
      stock: 25,
      brand: 'بوش Professional',
      tags: ['أدوات طاقة', 'لاسلكي', 'الأكثر مبيعاً'],
      specs: {
        البطارية: 'ليثيوم آيون 4.0 أمبير',
        الوزن: '1.5 كجم',
        السرعة: '0-1500 دورة/دقيقة',
        الجهد: '18 فولت',
      },
      isFeatured: true,
      categorySlug: 'power-tools',
    },
    {
      titleAr: 'طقم مفكات صناعة ألمانية - 12 قطعة',
      descriptionAr: 'طقم مفكات عالي الجودة مصنوع في ألمانيا، يتضمن 12 قطعة بمقاسات مختلفة.',
      price: 150,
      stock: 40,
      brand: 'ستانلي Expert',
      tags: ['معدات يدوية'],
      specs: { القطع: '12 قطعة', المنشأ: 'ألمانيا' },
      isFeatured: true,
      categorySlug: 'hand-tools',
    },
    {
      titleAr: 'دريل بوش احترافي',
      descriptionAr: 'دريل كهربائي احترافي للاستخدام الصناعي والمنزلي.',
      price: 450,
      stock: 2,
      brand: 'بوش',
      tags: ['أدوات طاقة'],
      isFeatured: false,
      categorySlug: 'power-tools',
    },
    {
      titleAr: 'طقم مفاتيح ربط صناعي',
      descriptionAr: 'طقم مفاتيح ربط متكامل للاستخدام الصناعي.',
      price: 120,
      stock: 15,
      brand: 'ستانلي',
      tags: ['معدات يدوية'],
      isFeatured: false,
      categorySlug: 'hand-tools',
    },
    {
      titleAr: 'منشار خشب دائري',
      descriptionAr: 'منشار دائري احترافي لقطع الخشب بدقة عالية.',
      price: 320,
      stock: 45,
      brand: 'ماكيتا',
      tags: ['أدوات طاقة'],
      isFeatured: false,
      categorySlug: 'power-tools',
    },
    {
      titleAr: 'صندوق أدوات معدني',
      descriptionAr: 'صندوق أدوات متين بفتحات متعددة.',
      price: 89,
      stock: 12,
      brand: 'ستانلي',
      tags: ['معدات يدوية'],
      isFeatured: false,
      categorySlug: 'hand-tools',
    },
    {
      titleAr: 'طقم لقم حفر',
      descriptionAr: 'طقم لقم حفر متنوع المقاسات للمعادن والخشب.',
      price: 75,
      stock: 150,
      brand: 'بوش',
      tags: ['براغي ومثبتات'],
      isFeatured: false,
      categorySlug: 'screws-fasteners',
    },
  ];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const { categorySlug, ...data } = p;
    const categoryId = categoryIds[categorySlug];
    if (!categoryId) continue;

    const productCode = i + 1;

    await prisma.product.upsert({
      where: { productCode },
      update: { ...data, categoryId },
      create: { ...data, categoryId, productCode },
    });
  }
}

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      phone: ADMIN_PHONE,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      phone: ADMIN_PHONE,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`✓ Admin account: ${ADMIN_EMAIL}`);
}

async function seedDemoUser() {
  const hashedPassword = await bcrypt.hash('User@123456', 12);

  await prisma.user.upsert({
    where: { email: 'ahmed@example.com' },
    update: { isActive: true },
    create: {
      name: 'أحمد المحمدي',
      email: 'ahmed@example.com',
      password: hashedPassword,
      phone: '+966501234567',
      role: Role.USER,
      isActive: true,
    },
  });

  console.log('✓ Demo user: ahmed@example.com / User@123456');
}

async function seedSampleOrder() {
  const user = await prisma.user.findUnique({ where: { email: 'ahmed@example.com' } });
  if (!user) return;

  const products = await prisma.product.findMany({ take: 2 });
  if (products.length < 2) return;

  const existing = await prisma.order.findUnique({ where: { orderNumber: 'ORD-12345' } });
  if (existing) return;

  const total =
    Number(products[0].price) * 1 + Number(products[1].price) * 1;

  const order = await prisma.order.create({
    data: {
      orderNumber: 'ORD-12345',
      userId: user.id,
      status: OrderStatus.PROCESSING,
      totalAmount: total,
      shippingAddress: 'حي الملقا، شارع الأمير محمد',
      shippingCity: 'الرياض',
      shippingCompany: 'أرامكس - سريع',
      items: {
        create: products.map((p) => ({
          productId: p.id,
          quantity: 1,
          unitPrice: p.price,
          productTitle: p.titleAr,
        })),
      },
      statusLogs: {
        create: [
          { status: OrderStatus.RECEIVED, note: 'تم استلام الطلب بنجاح' },
          { status: OrderStatus.PROCESSING, note: 'جاري تجميع وتغليف المعدات' },
        ],
      },
    },
  });

  console.log(`✓ Sample order: ${order.orderNumber} (قيد التجهيز)`);
}

async function main() {
  console.log('🌱 Seeding بيت العدد database...\n');

  await seedAdmin();
  await seedDemoUser();

  const categoryIds = await seedCategories();
  console.log(`✓ ${categories.length} categories`);

  await seedProducts(categoryIds);
  console.log('✓ Products seeded');

  await seedSampleOrder();

  console.log('\n✅ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
