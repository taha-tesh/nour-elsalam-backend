const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    const badRows = await prisma.$queryRawUnsafe(`
      SELECT id, "productCode"::text AS code
      FROM public."products"
      WHERE "productCode"::text !~ '^[0-9]+$'
      ORDER BY "createdAt" ASC, id ASC
    `);

    console.log('Non-numeric product codes:', JSON.stringify(badRows, null, 2));

    if (badRows.length === 0) {
      console.log('No invalid product codes found.');
      return;
    }

    const maxNumeric = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(MAX(CAST("productCode"::text AS INTEGER)), 0) AS max_code
      FROM public."products"
      WHERE "productCode"::text ~ '^[0-9]+$'
    `);

    const nextStart = Number(maxNumeric[0]?.max_code ?? 0) + 1;

    for (let i = 0; i < badRows.length; i += 1) {
      const row = badRows[i];
      const nextCode = nextStart + i;
      await prisma.$executeRawUnsafe(
        `UPDATE public."products" SET "productCode" = ${nextCode} WHERE id = '${row.id}'`
      );
      console.log(`Updated ${row.id} -> ${nextCode}`);
    }

    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."products"
      ALTER COLUMN "productCode" TYPE INTEGER
      USING ("productCode"::INTEGER)
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "products_productCode_key"
      ON public."products"("productCode")
    `);

    const sample = await prisma.$queryRawUnsafe(`
      SELECT "id", "productCode"
      FROM public."products"
      ORDER BY "productCode" ASC
      LIMIT 10
    `);

    console.log('Sample normalized product codes:', JSON.stringify(sample, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to normalize product codes:', error);
  process.exit(1);
});
